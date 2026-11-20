import { defineConfig } from 'vite';
import searchHandler from './api/search.js';
import lyricsHandler from './api/lyrics.js';

export default defineConfig({
  base: './',
  server: {
    port: 3500,
    host: true,
    open: false
  },
  plugins: [
    {
      name: 'api-dev-server',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url.startsWith('/api/search')) {
            res.status = (code) => { res.statusCode = code; return res; };
            res.json = (data) => {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(data));
              return res;
            };
            try {
              return await searchHandler(req, res);
            } catch (err) {
              return res.status(500).json({ error: err.message, results: [] });
            }
          }
          if (req.url.startsWith('/api/lyrics')) {
            res.status = (code) => { res.statusCode = code; return res; };
            res.json = (data) => {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(data));
              return res;
            };
            try {
              return await lyricsHandler(req, res);
            } catch (err) {
              return res.status(500).json({ error: err.message });
            }
          }
          next();
        });
      }
    }
  ]
});
