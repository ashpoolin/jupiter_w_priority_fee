import bs58 from "bs58";
import fs from 'fs';
import {
  Connection,
  Keypair,
  Transaction,
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import got from "got";
import { Wallet } from "@project-serum/anchor";
import promiseRetry from "promise-retry";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// This is a free Solana RPC endpoint. It may have ratelimit and sometimes
// invalid cache. I will recommend using a paid RPC endpoint.
const connection = new Connection("https://api.mainnet-beta.solana.com");


// load up your keypair
const wallet = new Wallet(Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(
        process.env.PRIVATE_KEY,
        'utf-8',
      ),
    ),
  )
));

// if using base58 private key
// const wallet = new Wallet(
  // Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY || "base 58 private key string from Phantom or similar"))
// );


console.log(wallet.publicKey.toBase58()); // confirm wallet loaded up OK

// const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const SOL_MINT = "So11111111111111111111111111111111111111112";

// wsol account
// const wsolAddress = await Token.getAssociatedTokenAddress(
//   ASSOCIATED_TOKEN_PROGRAM_ID,
//   TOKEN_PROGRAM_ID,
//   new PublicKey(SOL_MINT),
//   wallet.publicKey
// );
// console.log(wsolAddress.toBase58());

// const wsolAccount = await connection.getAccountInfo(wsolAddress);

const getCoinQuote = (inputMint, outputMint, amount, slippage) =>
  got
    .get(
      `https://quote-api.jup.ag/v1/quote?outputMint=${outputMint}&inputMint=${inputMint}&amount=${amount}&slippage=${slippage}`
    )
    .json();

const getTransaction = (route) => {
  return got
    .post("https://quote-api.jup.ag/v1/swap", {
      json: {
        route: route,
        userPublicKey: wallet.publicKey.toString(),
        // to make sure it doesnt close the sol account
        wrapUnwrapSOL: false,
      },
    })
    .json();
};

const getConfirmTransaction = async (txid) => {
  const res = await promiseRetry(
    async (retry, attempt) => {
      let txResult = await connection.getTransaction(txid, {
        commitment: "confirmed",
      });

      if (!txResult) {
        const error = new Error("Transaction was not confirmed");
        error.txid = txid;

        retry(error);
        return;
      }
      return txResult;
    },
    {
      retries: 40,
      minTimeout: 500,
      maxTimeout: 1000,
    }
  );
  if (res.meta.err) {
    throw new Error("Transaction failed");
  }
  return txid;
};


// require wsol to start trading, this function create your wsol account and fund 1 SOL to it
// await createWSolAccount();

// --- USER INPUTS --- //
const SELL_AMOUNT = 500_000; // amount of BONK you want to sell 
const DECIMALS = 1E5; // UI conversion rate
const quoteAmount = SELL_AMOUNT * DECIMALS; // in integer units
const SLIPPAGE_MAX = 0.2;  // as a % = 0.1, 0.2, 0.5, 1, 2, ...
const PRIORITY_RATE = 100; // micro-lamports per compute unit

console.log("attempting to sell " + SELL_AMOUNT + " BONK to SOL");
console.log("priority fee is set to " + PRIORITY_RATE + " micro-lamports per compute unit (10^-15 SOL/CU.");


const bonkToSol = await getCoinQuote(BONK_MINT, SOL_MINT, quoteAmount, SLIPPAGE_MAX);

const baseAmount = bonkToSol.data[0].outAmount
console.log(`you will receive ${baseAmount / LAMPORTS_PER_SOL} wsol`);

await Promise.all(
  [bonkToSol.data[0]].map(async (route) => {
    const { setupTransaction, swapTransaction, cleanupTransaction } =
      await getTransaction(route);

    await Promise.all(
      [setupTransaction, swapTransaction, cleanupTransaction]
        .filter(Boolean)
        .map(async (serializedTransaction) => {
          // get transaction object from serialized transaction
          const transaction = Transaction.from(
            Buffer.from(serializedTransaction, "base64")
          );
          const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ 
            microLamports: PRIORITY_RATE 
          });
          transaction.add(
            addPriorityFee
          );
          // perform the swap
          // Transaction might failed or dropped
          const txid = await connection.sendTransaction(
            transaction,
            [wallet.payer],
            {
              skipPreflight: true,
            }
          );
          try {
            await getConfirmTransaction(txid);
            console.log(`Success: https://solscan.io/tx/${txid}`);
          } catch (e) {
            console.log(`Failed: https://solscan.io/tx/${txid}`);
          }
        })
    );
  })
);