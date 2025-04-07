import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
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
        env: process.env,
        args: [...args, '-o', 'json'],
        stdin: process.stdin,
        stdout: stdout,
        stderr: stderr,
        fs
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
        return 'main: after reading secret - OK';

        await writeFile(serviceKeyPath, serviceKey);

        out.push(`afctl login kyma --service-key ${serviceKeyPath}`);
        out.push(await afctl('login', 'kyma', '--service-key', serviceKeyPath) || 'OK');

        await unlinkSync(serviceKeyPath);

        out.push('afctl push webapp -l');
        out.push(await afctl('push', 'webapp', '-l'));

        return out.join('\n');
    } catch(err) {
        out.push(err.toString());
        return out.join('\n');
    }
};
