// Test helper for alerts.sh: forwards /rest/v1 to PostgREST and plays a fake
// Twilio that records messages and fails for one number.
import { createServer, request } from "node:http";
import { writeFileSync } from "node:fs";
const [restPort, listenPort, logFile] = process.argv.slice(2);
const sent = [];
createServer((req, res) => {
  if (req.url.startsWith("/rest/v1")) {
    const up = request({ host: "127.0.0.1", port: restPort, path: req.url.replace(/^\/rest\/v1/, ""), method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    });
    return req.pipe(up);
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const form = new URLSearchParams(body);
    if (form.get("To") === "+972500000000") {
      res.writeHead(500);
      return res.end("simulated failure");
    }
    sent.push({ to: form.get("To"), from: form.get("From"), body: form.get("Body"), auth: req.headers.authorization });
    writeFileSync(logFile, JSON.stringify(sent));
    res.writeHead(201, { "content-type": "application/json" });
    res.end("{}");
  });
}).listen(Number(listenPort), "127.0.0.1");
