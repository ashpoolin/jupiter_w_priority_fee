# jupiter_w_priority_fee
Lazily forked from: [Jupiter's API arbs example](https://github.com/jup-ag/api-arbs-example)

## Warning: use at your own risk, I'm not resposible for you losing money. Abide by all local/applicable laws.

## Purpose
Example code demonstrating how to append priority fees to a jupiter transaction.

## Priority Fees - Units
Priority fee comes in the strange unit of micro-lamports per compute unit (let's call it a "priority rate"). 
1 uL = 10^-15 SOL. So, if you want the total SOL of a tx, then you can calculate that like this:
```
priority fee (SOL) = # compute units x priority rate (uL/CU) x 10^-15 SOL/uL
```

## How to use?
1. Install dependencies
```sh
pnpm install
```

2.  Just create a `.env` file with your PRIVATE_KEY. Select code block for whether it's base58 encoded or 32 byte json file.  

3. Set the parameters (see the script):
- RPC connection
- buy / sell qty
- slippage tolerance (as a %)
- priority fee

4. run the file
```sh
node bonk_buy.mjs // OR node bonk_sell.mjs
```

