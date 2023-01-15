import { Ed25519Keypair, RawSigner } from '@mysten/sui.js'
import bip39 from 'bip39'
import fs from 'fs'
import consoleStamp from 'console-stamp'
import axios from 'axios'
import randUserAgent from 'rand-user-agent'
import BigNumber from 'bignumber.js'
import HttpsProxyAgent from 'https-proxy-agent'

import { contracts, nftArray } from './utils/data.js'
import {
	parseFile,
	parseProxy,
	saveMnemonic,
	timeout,
	generateRandomAmount,
	provider,
	availableAccessories,
} from './utils/tools.js'

consoleStamp(console, { format: ':date(HH:MM:ss)' })

const errorHandler = () => {
	process.on('uncaughtException', err => {
		console.log(`Uncaught Exception: ${err?.message}`)
		fs.appendFile('logs.txt', `${err}\n\n`)
		process.exit(1)
	})

	process.on('unhandledRejection', (reason, promise) => {
		console.log('Unhandled rejection at ', promise, `reason: ${reason.message}`)
		fs.appendFile('logs.txt', `${reason}\n\n`)
	})
}

const mintNft = async (signer, args) => {
	console.log(`Minting: ${args[1]}`)

	return await signer.executeMoveCall({
		packageObjectId: '0x2',
		module: 'devnet_nft',
		function: 'mint',
		typeArguments: [],
		arguments: args,
		gasBudget: 10000,
	})
}

const mintCapy = async signer => {
	console.log(`Minting Capy`)

	let data = await signer.executeMoveCall({
		packageObjectId: contracts.VITE_PACKAGE_ID,
		module: 'eden',
		function: 'get_capy',
		typeArguments: [],
		arguments: [contracts.VITE_EDEN, contracts.VITE_REGISTRY],
		gasBudget: 10000,
	})

	if (data)
		return data.EffectsCert.effects.effects.events.find(i => i.moveEvent)
			.moveEvent.fields.id
}

const getRandomAccessory = () =>
	availableAccessories[Math.floor(Math.random() * availableAccessories.length)]

const getAccountBalances = async address => {
	let data = await provider.getCoinBalancesOwnedByAddress(address)
	let arr = data.map(obj => ({
		address: obj.details.reference.objectId,
		type: obj.details.data.type,
		balance: obj.details.data.fields.balance,
	}))

	return arr
		.filter(coin => coin.type.includes('sui'))
		.sort((a, b) => b.balance - a.balance)
}

const getAddressesByPrice = async (signer, price) => {
	let address = await signer.getAddress()
	let balances = await getAccountBalances(address)
	let balanceSum = 0
	let array = []

	for (let balance of balances) {
		if (balanceSum < price) {
			array.push(balance.address)
			balanceSum += +balance.balance
		}
	}

	return array
}

const buyRandomAccessory = async signer => {
	const randomAccessory = getRandomAccessory()
	const { name, price } = randomAccessory
	console.log(`Buying ${name}`)

	let coinAddress = await getAddressesByPrice(signer, price)

	let data = await signer.executeMoveCall({
		packageObjectId: contracts.VITE_PACKAGE_ID,
		module: 'capy_item',
		function: 'buy_mul_coin',
		typeArguments: [],
		arguments: [contracts.VITE_ITEM_STORE, name, coinAddress],
		gasBudget: 10000,
	})

	if (data)
		return data.EffectsCert.effects.effects.events.find(i => i.moveEvent)
			.moveEvent.fields.id
}

const addAccessoryToCapy = async (signer, capyId, accessoryId) => {
	console.log(`Adding accessory to Capy`)

	return await signer.executeMoveCall({
		packageObjectId: contracts.VITE_PACKAGE_ID,
		module: 'capy',
		function: 'add_item',
		typeArguments: [`${contracts.VITE_PACKAGE_ID}::capy_item::CapyItem`],
		arguments: [capyId, accessoryId],
		gasBudget: 10000,
	})
}

async function breedCapys(signer, firstCapy, secondCapy) {
	console.log(`Breeding capys`)

	let data = await signer.executeMoveCall({
		packageObjectId: contracts.VITE_PACKAGE_ID,
		module: 'capy',
		function: 'breed_and_keep',
		typeArguments: [],
		arguments: [contracts.VITE_REGISTRY, firstCapy, secondCapy],
		gasBudget: 10000,
	})

	if (data)
		return data.EffectsCert.effects.effects.events.find(i => i.moveEvent)
			.moveEvent.fields.id
}

const sellCapy = async (signer, capyId) => {
	let price = generateRandomAmount(0.01, 0.09).toFixed(2)
	console.log(`Listing new Capy for ${price} SUI`)

	let n = price * 1000000000
	let bn = BigNumber(n)

	return await signer.executeMoveCall({
		packageObjectId: contracts.VITE_PACKAGE_ID,
		module: 'capy_market',
		function: 'list',
		typeArguments: [`${contracts.VITE_PACKAGE_ID}::capy::Capy`],
		arguments: [contracts.VITE_CAPY_MARKET, capyId, bn],
		gasBudget: 10000,
	})
}

const checkIp = async proxyURL => {
	const [ip, port] = proxyURL.split('@')[1].split(':')
	const [_, login, password] = proxyURL
		.split('@')[0]
		.replace('//', '')
		.split(':')

	let data = await axios({
		method: 'GET',
		url: 'http://api64.ipify.org/?format=json',
		proxy: {
			host: ip,
			port: Number(port),
			auth: {
				username: login,
				password: password,
			},
			protocol: 'http',
		},
	}).catch(err => {
		console.log('[ERROR]', err.response?.data)
	})

	if (data) {
		return data?.data?.ip
	}
}

const requestSuiFromFaucet = async (proxy, recipient) => {
	console.log(`Requesting SUI from faucet for 0x${recipient}`)
	const axiosProxyInstance = axios.create({
		httpsAgent: HttpsProxyAgent(proxy.ip),
	})

	let data = await axiosProxyInstance('https://faucet.devnet.sui.io/gas', {
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': randUserAgent('desktop'),
		},
		data: JSON.stringify({
			FixedAmountRequest: { recipient: `0x${recipient}` },
		}),
		method: 'POST',
		timeout: 120000,
	}).catch(async err => {
		let statusCode = err?.response?.status
		console.log(
			'[FAUCET ERROR]',
			statusCode > 500 && statusCode < 600
				? 'Faucet down!'
				: err?.response?.statusText
		)
		proxy.limited = true
	})

	if (proxy.limited) {
		return false
	}

	if (data?.data?.error === null) {
		console.log(`Faucet request status: ${data?.statusText || data}`)
		return true
	} else {
		return false
	}
}

const waitForFaucetCoins = async address => {
	console.log('Waiting for coins from faucet...')

	for (let i = 0; i < 90; i++) {
		let balance = await provider.getCoinBalancesOwnedByAddress(address)

		if (balance.length > 0) {
			return true
		} else await timeout(2000)
	}

	console.log('Waiting for coins stopped, timeout of 3 minutes exceed')
}

const handleCapy = async signer => {
	let capyId = await mintCapy(signer)
	let accessoryId = await buyRandomAccessory(signer)
	await addAccessoryToCapy(signer, capyId, accessoryId)

	return capyId
}

const handleNFTs = async (proxy, mnemonic) => {
	try {
		const keypair = Ed25519Keypair.deriveKeypair(mnemonic)
		const address = keypair.getPublicKey().toSuiAddress()
		const signer = new RawSigner(keypair, provider)

		console.log(`Sui Address: 0x${address}`)
		console.log(`Mnemonic: ${mnemonic}`)

		const requestSuccessful = await requestSuiFromFaucet(proxy, address)

		if (requestSuccessful) {
			let gotCoins = await waitForFaucetCoins(address)
			if (gotCoins) {
				saveMnemonic(mnemonic)

				let firstCapy = await handleCapy(signer)
				let secondCapy = await handleCapy(signer)
				let newCapy = await breedCapys(signer, firstCapy, secondCapy)
				await sellCapy(signer, newCapy)

				for (let nft of nftArray) {
					await mintNft(signer, nft)
				}

				console.log(`https://explorer.sui.io/address/${address}?network=devnet`)
				console.log('-'.repeat(100))
			}
		} else {
			return false
		}
	} catch (err) {
		console.log(err.message)
	}
	return true
}

const start = async () => {
	errorHandler()
	let proxies = parseProxy('./config/proxy.txt')

	while (proxies.some(proxy => !proxy.limited)) {
		if (proxies.every(proxy => proxy.limited)) {
			console.log('All proxy limited')
			break
		}
		for (let proxy of proxies) {
			if (proxy.limited) {
				console.log('Limited proxy')
				continue
			}
			let isProxyValid = await checkIp(proxy.ip)
			if (isProxyValid) {
				let mnemonic = bip39.generateMnemonic()
				const handleResponse = await handleNFTs(proxy, mnemonic)

				if (!handleResponse) {
					console.log('Limited proxy')
					continue
				}
			} else {
				console.log(`Invalid proxy`)
			}
		}
	}
}

start()
