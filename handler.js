import { join } from 'node:path';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { Writable } from 'node:stream';
import { run } from '@sap/appfront-cli';

const secretPath = '/usr/src/app/secret/app-front';
const serviceKeyPath = '/tmp/service-key.json';

const writable = () => {
    const writable = new Writable();
    writable._write = (chunk, _, callback) => {
        writable.calls.push(Buffer.from(chunk).toString('utf8'));
        callback();
    };
    writable.toString = () => {
        return writable.calls.join('').trim();
    };
    writable.toJSON = () => {
        return JSON.parse(writable.toString() || 'null');
    };
    writable.isTTY = false;
    writable.calls = [];
    return writable;
};

const afctl = async (...args) => {
    const stdout = writable();
    const stderr = writable();
    const code = await run({
        args: [...args, '-o', 'json'],
        stdout: stdout,
        stderr: stderr
    });
    if (code !== 0) {
        throw new Error('Failed to run: ' + args.join(' ') + '\n' + stderr.toString());
    }
    return stdout.toJSON();
};

export async function main(event, context) {
    const out = [];
    try {
        const { request: req, response: res } = event.extensions;
    
        if (req.method.toUpperCase() !== 'POST') {
            res.status(405);
            return;
        }

        if (req.headers.authorization !== `Bearer ${process.env.TOKEN}`) {
            res.status(401);
            return; 
        }
        const content_endpoint = await readFile(join(secretPath, 'content_endpoint'), 'utf8');
        const uaa = await readFile(join(secretPath, 'uaa'), 'utf8');
        const serviceKey = `{"content_endpoint":"${content_endpoint}","uaa":${uaa}}`;
        
        await writeFile(serviceKeyPath, serviceKey);

        out.push(`$> afctl login kyma --service-key ${serviceKeyPath}`);
        out.push(await afctl('login', 'kyma', '--service-key', serviceKeyPath) || 'OK');
        
        await unlink(serviceKeyPath);

        out.push('$> afctl push function/webapp -l');
        out.push(JSON.stringify(await afctl('push', 'function/webapp', '-l'), null, 4));

        return out.join('\n');
    } catch(err) {
        out.push(err.toString());
        return out.join('\n');
    }
};
