const { XRouter } = require('xrouterjs');
const express = require('express');
const cors = require('cors');
const portUsed = require('tcp-port-used');
const fs = require('fs');
const path = require('path');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');

(async function() {
  try {

    const port = process.env.PORT || 45896;
    const inUse = await portUsed.check(port);
    if(inUse) {
      console.log(`\nPort ${port} is already in use. Please stop whatever process is using that port and try again.\n`);
      process.exit(1);
    }

    const client = new XRouter({
      network: XRouter.networks.MAINNET,
      queryNum: 3,
    });
    client.on(XRouter.events.INFO, message => {
      console.log(message);
    });
    client.on(XRouter.events.ERROR, message => {
      console.error(message);
    });

    console.log('client', client);

    const startClient = () => {
      client.start()
        .then(success => {
          if(!success)
            startClient();
        })
        .catch(err => {
          console.error(err);
          startClient();
        });
    };
    startClient();

    const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'));
    const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'));
    const publicDir = path.join(__dirname, 'public');

    express()
      .use(cors())
      .use(favicon(path.join(publicDir, 'favicon.ico')))
      .use(express.static(publicDir))
      .use(bodyParser.json())
      .use(bodyParser.text())
      .get('/', (req, res) => {
        res.type('text/html')
        res.send(htmlContent);
      })
      .post('/', async (req, res) => {
        const { body = {} } = req;
        console.log(`RPC request received with data: ${JSON.stringify(body)}`);
        const { method } = body;
        let { params } = body;
        if(!method || !params || !Array.isArray(body.params))
          return res.sendStatus(400);
        try {
          if(method === 'xrGetBlocks' || method === 'xrGetTransactions') {
            if(typeof params[1] === 'string') {
              const splitParams = params[1].split(',').map(s => s.trim());
              if(splitParams.length > 1) {
                params = [
                  params[0],
                  ...params[1].split(',').map(s => s.trim())
                ];
              }
            }
          }
          const xrRes = await client.callXrService(method, params);
          res.send(xrRes);
        } catch(err) {
          console.log(err);
          res.send(JSON.stringify({error: err.message}));
        }
      })
      .get('/server.js', (req, res) => {
        res.type('text/plain')
        res.send(serverContent);
      })
      .get('/xr/status', (req, res) => {
        res.type('application/json');
        res.send(JSON.stringify(client.status()));
      })
      .get('/xr/isStarted', (req, res) => {
        res.type('application/json');
        res.send(JSON.stringify(client.isStarted()));
      })
      .get('/xr/isReady', (req, res) => {
        res.type('application/json');
        res.send(JSON.stringify(client.isReady()));
      })
      .get('/xr/getBlockCount/:wallet', async (req, res) => {
        res.type('application/json');
        try {
          const blockHeight = await client.getBlockCount(req.params.wallet);
          res.send(JSON.stringify(blockHeight));
        } catch(err) {
          console.error(err);
          res.send('0');
        }
      })
      .get('/xr/getBlockHash/:wallet/:height', async (req, res) => {
        res.type('application/json');
        try {
          const blockHash = await client.getBlockHash(
            req.params.wallet,
            Number(req.params.height)
          );
          // res.send(`"${blockHash}"`);
          res.send(JSON.stringify(blockHash));
        } catch(err) {
          console.error(err);
          res.send('""');
        }
      })
      .get('/xr/getBlock/:wallet/:hash', async (req, res) => {
        res.type('application/json');
        try {
          const block = await client.getBlock(
            req.params.wallet,
            req.params.hash
          );
          res.send(block);
        } catch(err) {
          console.error(err);
          res.send('{}');
        }
      })
      .get('/xr/getTransaction/:wallet/:txid', async (req, res) => {
        res.type('application/json');
        try {
          const tx = await client.getTransaction(
            req.params.wallet,
            req.params.txid
          );
          res.send(tx);
        } catch(err) {
          console.error(err);
          res.send('{}');
        }
      })
      .listen(port, () => {
        console.log(`XRouter server listening at http://localhost:${port}`);
      });

  } catch(err) {
    console.error(err);
    process.exit(1);
  }

})();
