'use strict';

const fs = require('fs');
const puppeteer = require('puppeteer');
const resemble = require('node-resemble-js');
const Jimp = require('jimp');
const sprintf = require('sprintf-js').sprintf;

const config = JSON.parse(fs.readFileSync('./config.json'));

resemble.outputSettings({
  transparency: 0.2
});

const ss = async (p, c, u, ss) => {
    await p.goto(u);
    await p.waitFor(500);
    for (let i = 0; i < c.pre.length; i++) {
        await p.evaluate((f) => {
            eval(f);
        }, c.pre[i]);
        await p.waitFor(300);
    }
    await p.screenshot({
        path: ss,
        fullPage: true
    });
}

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    if (config.emulation) {
        await page.emulate(config.emulation);
    }

    const targetNum = config.targets.length;
    for (let i = 0; i < targetNum; i++) {
        const t = config.targets[i];
        const u = t.url;
        const s = t.scheme ? t.scheme : 'https';

        const ssname = t.url ? t.url.replace(/\/$/, '').replace('/','___') + '.png' : 'index.png';

        const stableUrl = s + '://' + config.stable + '/' + t.url;
        const stableSsPath = `${config.dir}stable/${ssname}`;
        await ss(page, config, stableUrl, stableSsPath);

        const upstreamUrl = s + '://' + config.upstream + '/' + t.url;
        const upstreamSsPath = `${config.dir}upstream/${ssname}`;
        await ss(page, config, upstreamUrl, upstreamSsPath);

        const diffSsPath = `${config.dir}diff/${ssname}`;
        resemble(stableSsPath).compareTo(upstreamSsPath).onComplete((data) => {
            if (data.misMatchPercentage > 0) {
                console.log(sprintf("[%03d/%03d]\t%s\t%s", (i + 1), targetNum, 'NG', u));
            } else {
                console.log(sprintf("[%03d/%03d]\t%s\t%s", (i + 1), targetNum, 'OK', u));
            }

            if (data.misMatchPercentage > 0 || config.outputNoDiffImage) {
                const stream = data.getDiffImage().pack();
                let buffer = new Buffer([])
                stream.on('data', (data) => {
                    buffer = Buffer.concat([buffer, data]);
                });
                stream.on('end', () => {
                    fs.writeFile(diffSsPath, buffer, null, () => {
                        Jimp.read(diffSsPath).then((image) => {
                            image.rgba(false).write(diffSsPath);
                        });
                    });
                });
            }
        });
        await page.waitFor(1000);
    }

    await browser.close();
})();
