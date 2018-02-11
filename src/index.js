import * as Discord from 'discord.js';
import * as logger from 'winston';
import dotenv from 'dotenv';
import * as steem from 'steem';
import * as http from 'http';
import axios from 'axios';

import 'babel-polyfill';

dotenv.config();

import { executeQuery } from './db';
import { searchTag } from './sql';
import { getDateTimeFromTimestamp } from './util';
import { getPrice, getOnlyPrice, countRatio } from './api';

import crypto from './crypto.json';
import config from './config.json';

// start client
const client = new Discord.Client();

client.on('ready', () => {
    logger.info(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    // GET INFO FOR MESSAGE
    let {
        id: currentMessageId,
        author: { username: currentUsername, id: currentUserId },
        content: currentContent,
        createdTimestamp: currentCreatedTimestamp
    } = msg;

    if (currentUserId === config.botId) {
        logger.info('BOT MESSAGE:', currentContent);
    } else {
        let currentCreatedTime = getDateTimeFromTimestamp(
            currentCreatedTimestamp
        );

        logger.info(
            `${currentUsername} (${currentUserId}) created "${currentContent}" on ${currentCreatedTime} (msg_id: ${currentMessageId})`
        );
        logger.info(currentContent);

        if (currentContent.substring(0, 1) == config.trigger) {
            var args = msg.content.substring(1).split(' ');
            var cmd = args[0];
            args = args.splice(1);
            // CONSOLE LOGGING
            logger.info(`CMD: ${cmd}`);
            logger.info(`ARGS: ${args}`);
            console.log(args);
            // END
            switch (cmd) {
                case 'info':
                    msg.reply(
                        'Created by @superoo7 on 2017-2018 (MIT LICENSE) https://github.com/superoo7/steem-discord'
                    );
                    break;
                case 'help':
                    msg.reply(`\n
BEEP BEEP 🤖, statBot HELP\n
Type \`${config.trigger}ping\` to get bot reply 'pong'\n
Type \`${config.trigger}tag <tag_name>\` to get details on votes, comments, topics and pending payout of that certain tags in past 7 days\n
Type \`${config.trigger}sbd\` to get sbd price from coinmarketcap\n
Type \`${config.trigger}steem\` to get steem price from coinmarketcap\n
Type \`${config.trigger}s/sbd\` to get steem to sbd ratio from coinmarketcap\n
Type \`${config.trigger}sbd/s\` to get sbd to steem ratio from coinmarketcap\n
Type \`${config.trigger}convert <value> <from this coin/currency> <to this coin/currency>\` to calculate crypto to fiat from coinmarketcap (e.g. \`${config.trigger}convert 10 steem myr\`)\n
Type \`${config.trigger}info\` to know more about this bot
                `);
                    break;
                case 'ping':
                    msg.reply('Pong!');
                    break;
                case 'tag':
                    msg.reply('Connecting to database....');
                    const query = searchTag(args[0]);
                    async function querying(query, tag) {
                        let result = await executeQuery(query);
                        console.log(result);
                        result === 'ERROR'
                            ? msg.reply('ERROR ON QUERY-ING')
                            : msg.reply(`There is
${result[0].Posts} posts 📘,
${result[0].Votes} votes 👍,
$${result[0].PendingPayouts} steem 💵,
${result[0].Comments} comments 💬,
Profitability 💰: ${result[0].PendingPayouts / result[0].Posts}
on #${tag} in the past 7 days`);
                    }
                    querying(query, args);
                    break;
                case 'sbd':
                    getPrice('steem-dollars', 'USD')
                        .then(data => {
                            msg.reply(`SBD Price is at ${data}`);
                        })
                        .catch(err => msg.reply('Server down'));
                    break;
                case 'steem':
                    getPrice('steem', 'USD')
                        .then(data => {
                            msg.reply(`Steem Price is at ${data}`);
                        })
                        .catch(err => msg.reply('Server down'));
                    break;
                case 's/sbd':
                    countRatio('steem', 'sbd')
                        .then(data => {
                            msg.reply(`Steem to SBD ratio is ${data}`);
                        })
                        .catch(err => msg.reply('Invalid Coin'));
                    break;
                case 'sbd/s':
                    countRatio('sbd', 'steem')
                        .then(data => {
                            msg.reply(`SBD to Steem ratio is ${data}`);
                        })
                        .catch(err => msg.reply('Invalid Coin'));
                    break;
                case 'convert':
                    if (args.length === 3 && !!parseInt(args[0])) {
                        const number = parseFloat(args[0]);
                        const coin1 = args[1].toLowerCase();
                        const coin2 = args[2].toLowerCase();
                        const isCoin1Crypto = coin1 in crypto;
                        const isCoin2Crypto = coin2 in crypto;
                        console.log(`${isCoin1Crypto} ${isCoin2Crypto}`)
                        if (isCoin1Crypto && isCoin2Crypto) {
                        // Crypto to Crypto
                            countRatio(coin1, coin2)
                                .then(data => {
                                    if (data === '-') {
                                        msg.reply('Invalid coin/currency')
                                    } else {
                                        msg.reply(`${number} ${coin1} =  ${parseFloat(data)*number} ${coin2}`);
                                    }
                                })

                        } else if (isCoin1Crypto) {
                        // Crypto to Fiat
                        // crypto, currency
                            getOnlyPrice(coin1, coin2)
                                .then(data => {
                                    if (data === '-') {
                                        msg.reply('Invalid coin/currency')
                                    } else {
                                        msg.reply(`${number} ${coin1} =  ${parseFloat(data)*number} ${coin2}`);
                                    }
                                })
                            .catch(err => msg.reply('Wrong Coin'));
                        } else if (isCoin2Crypto) {
                        // Fiat to Crypto
                            getOnlyPrice(coin2, coin1)
                                .then(data => {
                                    if (data === '-') {
                                        msg.reply('Invalid coin/currency')
                                    } else {
                                        msg.reply(`${number} ${coin1} =  ${number/parseFloat(data)} ${coin2}`);
                                    }
                                })
                            .catch(err => msg.reply('Wrong Coin'));
                        } else {
                        // error
                            msg.reply('Invalid coin/currency')
                        }
                    } else {
                        msg.reply(
                            `Please follow the format: "${
                                config.trigger
                            }convert <number> <CryptoCurrencyName> <CurrencyName>" (e.g. ${
                                config.trigger
                            }convert 1 eth myr)`
                        );
                    }
                    break;
                default:
                    msg.reply(`\`${config.trigger}help\` to get started`);
                    break;
            }
        }
    }
});
client.login(process.env.DISCORD_TOKEN); // http //     .createServer(function(request, response) { //         response.writeHead(200, { 'Content-Type': contentType }); //         response.end(content, 'utf-8'); //     }) //     .listen(process.env.PORT || 5000);
