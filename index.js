/* eslint-disable brace-style */

// Requirements
const Discord = require('discord.js');
const axios = require('axios');
const dotenv = require('dotenv');
const oauth = require('oauth');
const express = require('express');
const Twitter = require('twitter-lite');
const app = express();

const client = new Discord.Client();
dotenv.config();

/* Verified Users
---------------------
Currently not in use */
const verified_users = [];
const pending_users = [];
const MAX_PENDING_STARTUP = 20;

// Setup oauth
const request_token_url = 'https://api.twitter.com/oauth/request_token';
const access_token_url = 'https://api.twitter.com/oauth/access_token';
const authenticate_url = 'https://api.twitter.com/oauth/authenticate?oauth_token=';
const consumer = new oauth.OAuth(request_token_url, access_token_url, process.env.CONSUMER_PUBLIC,
	process.env.CONSUMER_SECRET, '1.0A', 'http://localhost:8080/authenticate', 'HMAC-SHA1');

// Meta data
const twitter_meta = {
	request_token: '',
	request_secret: '',
	verifier: '',
	access_token: null,
	access_token_secret: null,
	twitter_client: null,
	last_tweet_id: null,
};

/* Site Logic */
app.get('', (req, res) => {
	res.send('Welcome!');
});

app.get('/authenticate', (req, res) => {
	const verifier = req.query.oauth_verifier;
	twitter_meta.verifier = verifier;
	
	consumer.getOAuthAccessToken(twitter_meta.request_token, twitter_meta.request_secret, verifier, function (error, oauthAccessToken, oauthAccessTokenSecret, _) {
		if (error) {
			console.log('error: ', error);
		} else {
			res.status(200).send('Successful verification. All messages that you send in channels that contain this bot will be tweeted under your ' +
									'verified account.\n You may close this tab');
			twitter_meta.access_token = oauthAccessToken;
			twitter_meta.twitter_client = new Twitter({
				subdomain: 'api',
				version: '1.1',
				consumer_key: process.env.CONSUMER_PUBLIC,
				consumer_secret: process.env.CONSUMER_SECRET,
				access_token_key: oauthAccessToken,
				access_token_secret: oauthAccessTokenSecret,
			});

			twitter_meta.twitter_client
				.get('account/verify_credentials')
				.then(_ => {
					client.channels.cache.get(discord_meta.channel_id).send('Verified!');
				}).catch(console.error);

		}
	});
});

app.listen(process.env.PORT || 8080, () => {
	console.log('listening at port 8080');
});

/* Discord Bot Logic */
const command = '!';

// store meta data for discord and twitter
const discord_meta = {
	channel_id: null,
	channel_name: null,
};

client.on('ready', () => {
	console.log(`Logged in as ${client.user.id}!`);
	console.log('New welcome message!');
	while(pending_users.length > MAX_PENDING_STARTUP) {
		pending_users.shift();
	}
});

// Message handling
client.on('message', msg => {
	if (msg.author.bot) return;
	// Supports verification and tweeting for a single channel
	const channel = client.channels.cache.get(discord_meta.channel_id);
	const user = msg.author.id;

	if (msg.content === `${command}authorize`) {
		// if (verified_users.includes(user)) {
		// 	user.send('Already verified');
		// }
		authorize(msg);
	} else if (authorized_channel(msg) && msg.content === `${command}delete`) {
		remove_tweet(); // Deletes most recent tweet. Only works once
	} else if (authorized_channel(msg)) { // General case: send a tweet
		const twitter_client = twitter_meta.twitter_client;

		const tweet = twitter_client.post('statuses/update', {
			status: msg.content, // msg contains all the meta data, we want only the content
		}).then(res => {
			// console.log('Successful tweet');
			// console.log('Tweet id:', res.id_str);
			twitter_meta.last_tweet_id = res.id_str;
		}).catch((e) => {
			console.log('error when tweeting:', console.error(e));
			channel.send('Error when tweeting');
		});
	} else {
		// console.log('Nonsense');
	}
	discord_meta.channel_id = msg.channel.id;
	discord_meta.channel_name = msg.channel_name;
});

function authorize(msg) {
	msg.reply(`You said ${msg.content}`);
	consumer.getOAuthRequestToken((err, token, token_secret, _) => {
		if (err) {
			console.log(err);
		} else {
			twitter_meta.request_token = token;
			twitter_meta.request_secret = token_secret;
			console.log('sending message to', msg.author.id);
			msg.author.send(`Verify here: ${authenticate_url}${token}`);
		}
	});
}

function remove_tweet() {
	const twitter_client = twitter_meta.twitter_client;
	twitter_client.post(`statuses/destroy/${twitter_meta.last_tweet_id}`)
		.then(_ => {
			channel.send('Deleted previous tweet!');
		}).catch((e) => {
			console.log('Failed to delete tweet (likely already deleted)', twitter_meta.last_tweet_id);
			channel.send('Failed to delete tweet (likely already deleted)');
			console.error(e);
		});
}

function authorized_channel(msg) {
	return msg.channel.id === discord_meta.channel_id && twitter_meta.twitter_client != null;
}

client.login(process.env.DISCORD_TOKEN);