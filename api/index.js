const express = require('express');
const logger  = require('morgan');
const limiter = require('express-rate-limit');

////////////////////////////////////////////////////////////

const app = express();

const setHeaders = (req, res, next) => {
      // remove default headers
      res.removeHeader('x-powered-by');
      res.removeHeader('date');
      res.removeHeader('connection');
      
      // important headers
      res.setHeader('access-control-allow-origin', '*');
      res.setHeader('access-control-expose-headers', '*');

      next();
};

// limit 1000 request per hour
const limit = limiter({
      windowMs: 60 * 60 * 1000,
      max: 1000,
      standardHeaders: false,
      legacyHeaders: false
});

////////////////////////////////////////////////////////////

app.use(setHeaders);
app.use(limit);
app.use(logger('tiny'));

////////////////////////////////////////////////////////////

app.all('/', async (req, res) => {
      try {
            let url = req.query.url;
            const body = await getBody(req);

            if (!url) throw Error('Missing target url.');

            url = decodeURIComponent(url);
            url = url.replace(/$|,/g, match => match == '$' ? '?' : '&');

            console.log('ini url: ', url)
            
            // forward request
            const rez = await fetcher(url, {
                  method: req.method,
                  headers: req.headers,
                  body: body
            });
            
            // use .write() instead of .send() method
            res.writeHead(rez.statusCode, rez.headers);
            res.write(rez.body, 'binary');
            res.end();
      } 
      
      catch (error) {
            console.log(error);
            res.status(500).send(error.message);
      }
});

////////////////////////////////////////////////////////////

async function fetcher(url, options) {
      const REDIRECT_CODES = [301, 302, 303, 307, 308];

      if ('host' in options.headers) {
            delete options.headers.host;
      }
      
      try {
            let res = await request(url, options);
            
            // follow redirect
            if (REDIRECT_CODES.includes(res.statusCode)) {
                  url = res.headers.location;
                  res = await fetcher(url, options);
            }

            res.url = url;
            return Promise.resolve(res);
      } 
      
      catch (error) {
            return Promise.reject(error);
      }
}

function request(url, options) {
      const callback = (resolve, reject) => {
            const { protocol } = new URL(url);
            const module = protocol.slice(0, -1);
            const http = require(module); // load http(s) module

            const req = http.request(url, options, async res => {
                  res.body = await getBody(res);
                  resolve(res);
            });

            req.on('error', reject);

            if (options.body) {
                  req.write(options.body);
            }

            req.end();
      };

      return new Promise(callback);
}

function getBody(stream) {
      const callback = resolve => {
            const chunks = [];

            stream.on('data', chunk => {
                  chunks.push(chunk);
            });

            stream.on('end', () => {
                  resolve(Buffer.concat(chunks));
            });
      };

      return new Promise(callback);
}

////////////////////////////////////////////////////////////

module.exports = app;
