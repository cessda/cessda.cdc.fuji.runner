//To use if testing against CDC staging
const cdcusername = process.env['CDC_USERNAME'];
const cdcpassword = process.env['CDC_PASSWORD'];

const usernamePasswordBuffer = Buffer.from(
    `${cdcusername}:${cdcpassword}`,
    "utf-8"
);
export const base64UsernamePassword = usernamePasswordBuffer.toString("base64");
export const requestHeaders = {
    Authorization: `Basic ${base64UsernamePassword}`,
};