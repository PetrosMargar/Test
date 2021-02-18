const jsSHA = require("jssha");
const http = require('http');
const fs = require('fs');
const args = require('yargs').argv;
const { Builder, By, until } = require('selenium-webdriver');
const { log } = require("console");
require('geckodriver');
require('chromedriver');

const config = args.config;

const jsonString = fs.readFileSync(config, 'utf8');
const customer = JSON.parse(jsonString);

authentificationBySsoUrlTest = async () => {
    let driver = await new Builder().forBrowser(customer.browser).build();
    let user = await requestSsoLogin(customer);
    const testUser = JSON.parse(user);
    console.assert((testUser.securityToken != null && testUser.securityToken !== ''), 'Authentification failed!');
    driver.quit();
}

authentificationByInputElementsTest = async () => {

    let driver = await new Builder().forBrowser(customer.browser).build();

    await driver.get('http://localhost:10000');
    await driver.findElement(By.className('loginName')).sendKeys(customer.loginName);
    await driver.findElement(By.className('loginInstallId')).sendKeys(customer.loginInstallId);
    // await driver.findElement(By.className('loginClientId')).sendKeys(customer.clientId);
    await driver.findElement(By.className('loginSubmitButton')).click();

    await driver.wait(until.elementLocated(By.className('lhdialogButton')), 35000).click();

    let containerIn = driver.wait(until.elementLocated(By.className('loginControl')), 20000);
    containerIn.isDisplayed().then((state) => { console.assert((!state), 'Login failed!'); });

    await driver.wait(until.elementLocated(By.id('infoTabOpener')), 4000).click();
    await driver.wait(until.elementLocated(By.id('logoutButton')), 4000).click();

    let containerOut = driver.wait(until.elementLocated(By.className('loginControl')), 20000);
    containerOut.isDisplayed().then((state) => { console.assert((state), 'Logout failed!'); });
    driver.quit();
}

authentificationByQueryStringTest = async () => {

    let driver = await new Builder().forBrowser(customer.browser).build();

    await driver.get('http://localhost:10000' + '?user=' + customer.loginName +
        '&pw=' + customer.password + '&installId=' + customer.loginInstallId);

    await driver.findElement(By.className('loginSubmitButton')).click();

    await driver.wait(until.elementLocated(By.className('lhdialogButton')), 35000).click();

    let containerIn = driver.wait(until.elementLocated(By.className('loginControl')), 20000);
    containerIn.isDisplayed().then((state) => { console.assert((!state), 'authentificationByQueryStringTest Login failed!'); });

    driver.quit();
}

(async function testsCall() {
    try {
        let testNames = customer.testsList;
        for (let i = 0; i < testNames.length; i++) {
            await this[testNames[i]]();
        }
    }
    catch (err) {
        console.log(err);
    }
})();

const requestSsoLogin = async (customer) => {
    let time = new Date();
    let challenge = await fetch('http://localhost:10000/Api/GetSalt?_=' + time.getTime());
    challenge = JSON.parse(challenge);

    let shaObj = new jsSHA("SHA-256", "TEXT");
    shaObj.update(customer.password);
    let pwHash = shaObj.getHash("B64");
    shaObj = new jsSHA("SHA-256", "TEXT");
    shaObj.update(pwHash + challenge.salt);

    let transportHash = challenge.id + "~~~" + shaObj.getHash("B64");

    let user = await fetch(
        'http://localhost:10000/Api/Authenticate?installid=' + encodeURIComponent(customer.loginInstallId) +
        '&username=' + encodeURIComponent(customer.loginName) + '&password=' + encodeURIComponent(transportHash) +
        '&mandantid=' + encodeURIComponent(customer.clientId) + '&_=' + time.getTime);

    return user;
}

function fetch(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (response) => {
            let chunks_of_data = [];

            response.on('data', (fragments) => {
                chunks_of_data.push(fragments);
            });

            response.on('end', () => {
                let response_body = Buffer.concat(chunks_of_data);
                resolve(response_body.toString());
            });

            response.on('error', (error) => {
                reject(error);
            });
        });
    });
}