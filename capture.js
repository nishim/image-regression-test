'use strict';

const fs = require('fs');
const puppeteer = require('puppeteer');
const resemble = require('node-resemble-js');
const Jimp = require('jimp');

const config = JSON.parse(fs.readFileSync('./config.json'));

resemble.outputSettings({
  transparency: 0.2
});

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    for (let i = 0; i < config.targets.length; i++) {
        const ssname = config.targets[i].url.replace(/\/$/, '').replace('/','___') + '.png';

        const stableUrl = config.stable + config.targets[i].url;
        const stableSsPath = `${config.dir}stable/${ssname}`;
        await page.goto(`${stableUrl}`);
        await page.waitFor(7000);
        for (let j = 0; j < config.pre.length; j++) {
            await page.evaluate((f) => {
                eval(f);
            }, config.pre[j]);
            await page.waitFor(300);
        }
        await page.screenshot({
            path: `${config.dir}stable/${ssname}`,
            fullPage: true
        });

        const upstreamUrl = config.upstream + config.targets[i].url;
        const upstreamSsPath = `${config.dir}upstream/${ssname}`;
        await page.goto(`${upstreamUrl}`);
        await page.waitFor(7000);
        for (let j = 0; j < config.pre.length; j++) {
            await page.evaluate((f) => {
                eval(f);
            }, config.pre[j]);
            await page.waitFor(300);
        }
        await page.screenshot({
            path: `${config.dir}upstream/${ssname}`,
            fullPage: true
        });

        const diffSsPath = `${config.dir}diff/${ssname}`;
        resemble(stableSsPath).compareTo(upstreamSsPath).onComplete((data) => {
            if(data.misMatchPercentage > 0) {
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
            } else {
                fs.copyFile('./banzai_people.png', diffSsPath, (err) => {});
            }
        });
    }

    await browser.close();
})();
