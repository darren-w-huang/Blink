/*
Blink is a Discord bot that allows any non-bot messages to be tweeted in channels that are monitored by the bot.
*/

// Requirements
const Discord = require('discord.js');
const dotenv = require('dotenv');
const oauth = require('oauth');
const express = require('express');
const Twitter = require('twitter-lite');
const app = express();

const client = new Discord.Client();
dotenv.config();

/* Verified Users
---------------------
Feature currently disabled. 
All users who post in channels monitored by the bot, once a twitter account is verified, will be sent as tweets.
// const verified_users = [];
// const pending_users = [];
// const MAX_PENDING_STARTUP = 20;
*/

// Setup oauth
const request_token_url = 'https://api.twitter.com/oauth/request_token';
const access_token_url = 'https://api.twitter.com/oauth/access_token';
const authenticate_url = 'https://api.twitter.com/oauth/authenticate?oauth_token=';
const consumer = new oauth.OAuth(request_token_url, access_token_url, process.env.CONSUMER_PUBLIC,
	process.env.CONSUMER_SECRET, '1.0A', 'https://blink-crispy-waffle.herokuapp.com/authenticate/', 'HMAC-SHA1');

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
const max_tweet_length = 280;

// store meta data for discord and twitter
const discord_meta = {
	channel_id: null,
	channel_name: null,
};

client.on('ready', () => {
	console.log(`Logged in as ${client.user.id}!`);
	console.log('New welcome message!');
});

// Message handling
client.on('message', msg => {
	if (msg.author.bot) return;
	// Supports verification and tweeting for a single channel
	const channel = msg.channel;
	
	if (msg.content === `${command}authorize`) {
			authorize(msg);
	} else if (authorized_channel(msg) && msg.content === `${command}delete`) {
			remove_tweet(); // Deletes most recent tweet. Only works once
	} else if (authorized_channel(msg) && msg.content === `${command}help`) {
			channel.send(`${command}authorize to verify, or ${command}delete to remove your most recent tweet.\n` +
			'delete will remove only one tweet, even if called multiple times in succession');
	} else if (authorized_channel(msg)) { // General case: send a tweet
		const twitter_client = twitter_meta.twitter_client;
		var body = msg.content;
		// Include any attachments
		for (const attachment of msg.attachments) {
			body += ' ' + attachment[1].attachment;
		} 
		if (body.length > max_tweet_length) { // Alert user when tweet fails from max length
			channel.send('Tweet is too long. Could not send.');
			return;
		}
		const tweet = twitter_client.post('statuses/update', {
			status: body, // msg contains all the meta data, we want only the content
		}).then(res => {
			twitter_meta.last_tweet_id = res.id_str;
		}).catch((e) => {
			console.log('error when tweeting:', console.error(e));
			channel.send('Error when tweeting');
		});
	} 
	discord_meta.channel_id = msg.channel.id;
	discord_meta.channel_name = msg.channel_name;
});

/* Directly messages the user a link to verify that they want the bot to have access 
   to their twitter account. Any non-bot messages in channels monitored by the bot will be tweeted. */
function authorize(msg) {
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

/* Removes only one tweet, specifically the previous one, even if called multiple times in succession. */
function remove_tweet() {
	const twitter_client = twitter_meta.twitter_client;
	const channel = client.channels.cache.get(discord_meta.channel_id);
	twitter_client.post(`statuses/destroy/${twitter_meta.last_tweet_id}`)
		.then(_ => {
			channel.send('Deleted previous tweet!');
		}).catch((e) => {
			console.log('Failed to delete tweet (likely already deleted)', twitter_meta.last_tweet_id);
			channel.send('Failed to delete tweet (likely already deleted)');
			console.error(e);
		});
}

// Checks that channel id matches the authorized channel
function authorized_channel(msg) {
	return msg.channel.id === discord_meta.channel_id && twitter_meta.twitter_client != null;
}

client.login(process.env.DISCORD_TOKEN);