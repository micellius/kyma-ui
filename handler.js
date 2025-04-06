const { spawnSync } = require('child_process');
const afctl = (...args) => spawnSync('node', ['node_modules/@sap/appfront-cli/lib/index.js', ...args]);
const secretPath = '/usr/src/app/secret/app-front';
const { join } = require('path');
const fs = require('fs');

module.exports = {
    main: async function(event) {
        const { request: req, response: res } = event.extensions;
        
        if (req.method.toUpperCase() !== 'POST') {
            return res.status(405);
        }

        if (req.headers.authorization !== `Bearer ${process.env.TOKEN}`) {
            return res.status(401);
        }

        try {
            const content_endpoint = fs.readFileSync(join(secretPath, 'content_endpoint'), 'utf8');
            const uaa = fs.readFileSync(join(secretPath, 'uaa'), 'utf8');
            const serviceKey = `{"content_endpoint":"${content_endpoint}","uaa":${uaa}}`;
            const out = ['<html><body><pre>'];

            fs.writeFileSync('service-key.json', serviceKey);

            const login = afctl('login', 'kyma', '--service-key', 'service-key.json');
            out.push('afctl login kyma --service-key \'{...}\'');
            out.push( `stderr: ${ login.stderr.toString() }` );
            out.push( `stdout: ${ login.stdout.toString() }` );

            fs.unlinkSync('service-key.json');

            const push = afctl('push', 'webapp', '-l');
            out.push('afctl push webapp -l');
            out.push(`stderr: ${ push.stderr.toString() }`);
            out.push(`stdout: ${ push.stdout.toString() }`);

            out.push('</pre></body></html>');

            return out.join('\n');
        } catch(err) {
            return err.toString();
        }
    }
};
