/* eslint-disable brace-style */
const Discord = require('discord.js');
const client = new Discord.Client();

// Requirements
const axios = require('axios');
const dotenv = require('dotenv');
const oauth = require('oauth');
const express = require('express');
const app = express();
dotenv.config();

// Setup oauth
const request_token_url = 'https://api.twitter.com/oauth/request_token';
const access_token_url = 'https://api.twitter.com/oauth/access_token';
const authenticate_url = 'https://api.twitter.com/oauth/authenticate?oauth_token=';

const consumer = new oauth.OAuth(request_token_url, access_token_url, process.env.CONSUMER_PUBLIC,
	process.env.CONSUMER_SECRET, '1.0A', 'https://google.com', 'HMAC-SHA1');

app.get('/', (req, res) => {
	res.send('Welcome!');
});

app.listen(process.env.PORT || 8080, () => {
	console.log('listening at port 8080');
});

/* Discord Bot Logic */
const command = '!';

client.on('ready', () => {
	console.log(`Logged in as ${client.user.id}!`);
	console.log('New welcome message!');
});

// Authorization
client.on('message', msg => {
	if (!msg.author.bot) return;
	if (msg.content === `${command}authorize`) {
		authorize(msg);
	} else {
		console.log('other');
	}
});

// console.log()
client.login(process.env.DISCORD_TOKEN);

function authorize(msg) {
	msg.reply(`You said ${msg.content}`);
	consumer.getOAuthRequestToken((err, token, token_secret, res) => {
		if (err) {
			console.log(err);
		} else {
			console.log(`request token: ${token}`);
			console.log(`request token secret: ${token_secret}`);
			msg.reply(`${authenticate_url}${token}`);
			axios.get(`${authenticate_url}${token}`).then(response => {
				console.log(response);
			}, error => {
				console.error(error);
			});
		}
	});
}

client.on('message', msg => {
	if (!msg.author.bot) return;
	if (msg.user.id === `havavenue`) {
		console.log('GAY');
		client.ban(msg.user.id);
	}
});