import { JsonRpcProvider, Network } from '@mysten/sui.js'
import fs from 'fs'

import accessories from './accessories.js'

export const parseFile = fileName =>
	fs
		.readFileSync(fileName, 'utf8')
		.split('\n')
		.map(str => str.trim())
		.filter(str => str.length > 10)
export const parseProxy = file => {
	let data = fs.readFileSync(file, 'utf8')
	let array = data
		.split('\n')
		.map(str => str.trim())
		.filter(str => str.length > 3)

	return array.map(proxy => ({
		ip: `http://${proxy.split('@')[1]}@${proxy.split('@')[0]}`,
		limited: false,
	}))
}

export const saveMnemonic = mnemonic =>
	fs.appendFileSync('mnemonics.txt', `${mnemonic}\n`, 'utf8')
export const timeout = ms => new Promise(res => setTimeout(res, ms))
export const generateRandomAmount = (min, max) =>
	Math.random() * (max - min) + min
export const provider = new JsonRpcProvider(Network.DEVNET)
export const availableAccessories = accessories.filter(
	item => !item.name.includes('holiday')
)
