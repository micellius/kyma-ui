const { spawnSync } = require('child_process');
const afctl = (...args) => spawnSync('node', ['node_modules/@sap/appfront-cli/lib/index.js', ...args]);
const secretPath = '/usr/src/app/secret/app-front';
const { join } = require('path');
const fs = require('fs');

module.exports = {
    main: async function(event) {
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

            const content_endpoint = fs.readFileSync(join(secretPath, 'content_endpoint'), 'utf8');
            const uaa = fs.readFileSync(join(secretPath, 'uaa'), 'utf8');
            const serviceKey = `{"content_endpoint":"${content_endpoint}","uaa":${uaa}}`;

            fs.writeFileSync('/tmp/service-key.json', serviceKey);

            const login = afctl('login', 'kyma', '--service-key', 'service-key.json');
            out.push('afctl login kyma --service-key \'{...}\'');
            out.push( `stderr: ${ login.stderr.toString() }` );
            out.push( `stdout: ${ login.stdout.toString() }` );

            fs.unlinkSync('/tmp/service-key.json');

            const push = afctl('push', 'webapp', '-l');
            out.push('afctl push webapp -l');
            out.push(`stderr: ${ push.stderr.toString() }`);
            out.push(`stdout: ${ push.stdout.toString() }`);

            return out.join('\n');
        } catch(err) {
            out.push(err.toString());
            return out.join('\n');
        }
    }
};
