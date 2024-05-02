import { CoinStruct, SuiObjectData } from "@mysten/sui.js/client";
import { SUI_TYPE_ARG, SuiKit, SuiObjectArg, SuiTxBlock } from "@scallop-io/sui-kit";
import BigNumber from "bignumber.js";
import * as dotenv from "dotenv";
import { coins } from "./coinTypes";
import { MAIN_NODES } from "./const/rpc";
import { Logger } from "./logger";
import { getAllCoin } from "./tradeUtils";
import { ProtocolConfig } from "@mysten/sui.js/client";
import { shuffle } from "./utils/common";
import { SpamTxBuilder } from "./contract";
import { decodeSuiPrivateKey } from "@mysten/sui.js/cryptography";
dotenv.config();

// const secretKey = process.env.secretKey;
// const parsedSecretKey = secretKey!.startsWith("suiprivkey")
//   ? Array.from(decodeSuiPrivateKey(secretKey!).secretKey)
//       .map((b) => ("00" + b.toString(16)).slice(-2))
//       .join("")
//   : secretKey!;
const mnemonics = process.env.MNEMONICS!;
const batchSize = +(process.env.BATCH_SIZE ?? MAIN_NODES.length);

let gasCoins: null | CoinStruct[] = null;
console.log(`Batch Size: ${batchSize}`);

const suiKit: SuiKit = new SuiKit({
  mnemonics,
  // secretKey: parsedSecretKey!
});

let protocolConfig: null | ProtocolConfig = null;
const getProtocolConfig = async () => {
  if (!protocolConfig) {
    protocolConfig = await suiKit.client().getProtocolConfig();
  }
  return protocolConfig;
};

const executeSpam = async (suiKit: SuiKit, counterObj: SuiObjectArg) => {
  try {
    const tx = new SuiTxBlock();
    tx.setSender(suiKit.currentAddress());
    SpamTxBuilder.increment_counter(tx, counterObj);

    Logger.info(`Sending spam with node ${suiKit.suiInteractor.currentFullNode}`);
    const txBuildBytes = await tx.txBlock.build({
      client: suiKit.client(),
      protocolConfig: await getProtocolConfig(),
    });

    const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
    // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
    const res = await suiKit.client().executeTransactionBlock({
      transactionBlock: bytes,
      signature,
      options: {
        showEffects: true,
      },
    });

    if (res.effects?.status.status === "success") {
      Logger.success(`Success spam: ${res.digest} with node ${suiKit.suiInteractor.currentFullNode}`);
      return true;
    } else {
      console.error(res.errors ? res.errors[0] : "Error occurred");
      return false;
    }

  } catch (e) {
    console.error(e);
  }
  return false;
};

const splitGasCoins = async (): Promise<boolean> => {
  try {
    const suiBalance = await suiKit.getBalance(SUI_TYPE_ARG);
    if (suiBalance.coinObjectCount < batchSize) {
      // split coins
      const totalAmount = BigNumber(suiBalance.totalBalance).div(batchSize).precision(9).toNumber();
      const amounts = Array(batchSize - 1).fill(totalAmount);
      const tx = new SuiTxBlock();
      tx.setSender(suiKit.currentAddress());

      const coins = tx.splitSUIFromGas(amounts);
      tx.transferObjects(
        amounts.map((_, idx) => coins[idx]),
        suiKit.currentAddress()
      );

      const txBuildBytes = await tx.txBlock.build({
        client: suiKit.client(),
        protocolConfig: await getProtocolConfig(),
      });

      const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
      const res = await suiKit.client().executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showEffects: true,
        },
      });

      if (res.effects && res.effects.status.status === "success") {
        console.log(`success: ${res.digest}`);
      } else {
        console.error(`failed: ${res.digest}`);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return true;
    }
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const mergeCoins = async (tx: SuiTxBlock = new SuiTxBlock()): Promise<boolean> => {
  try {
    const [userInCoins, userOutCoins] = await Promise.all([
      getAllCoin(suiKit, suiKit.currentAddress(), coins["usdc"].address),
      getAllCoin(suiKit, suiKit.currentAddress(), coins["usdt"].address),
      //   getAllCoin(suiKit, suiKit.currentAddress(), coins["cetus"].address),
      //   getAllCoin(suiKit, suiKit.currentAddress(), coins["eth"].address),
    ]);

    let hasMergeAction = false;
    tx.setSender(suiKit.currentAddress());

    if (userInCoins.length > 1) {
      const targetCoins = userInCoins.map((coinStruct) => {
        return tx!.txBlock.object(coinStruct.coinObjectId);
      });
      tx!.mergeCoins(targetCoins[0], targetCoins.slice(1, Math.min(500, targetCoins.length)));
      hasMergeAction = true;
    }
    if (userOutCoins.length > 1) {
      const targetCoins = userOutCoins.map((coinStruct) => {
        return tx!.txBlock.object(coinStruct.coinObjectId);
      });
      tx!.mergeCoins(targetCoins[0], targetCoins.slice(1, Math.min(500, targetCoins.length)));
      hasMergeAction = true;
    }

    if (hasMergeAction) {
      const txBuildBytes = await tx.txBlock.build({
        client: suiKit.client(),
        protocolConfig: await getProtocolConfig(),
      });
      const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
      const res = await suiKit.client().executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showEffects: true,
        },
      });

      if (res.effects && res.effects.status.status === "success") {
        console.log(`success: ${res.digest}`);
      } else {
        console.error(`failed: ${res.digest}`);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, +(process.env.BATCH_INTERVAL ?? 2000)));
    }
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const timeout = async (ms: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("Task took too long"));
    }, ms);
  });
};

const requestGasCoin = async (suiKit: SuiKit, addresses: string[]) => {
  try {
    const tx = new SuiTxBlock();
    tx.setSender(suiKit.currentAddress());
    
    const coins = tx.splitSUIFromGas(addresses.map(() => 1e8));
    addresses.map((_, idx) => {
      tx.transferObjects([coins[idx]], addresses[idx]);
    })

    const txBuildBytes = await tx.txBlock.build({
      client: suiKit.client(),
      protocolConfig: await getProtocolConfig(),
    });
    const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
    // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
    const res = await suiKit.client().executeTransactionBlock({
      transactionBlock: bytes,
      signature,
      options: {
        showEffects: true,
      },
    });
    if (res.effects?.status.status === "success") {
      Logger.success(`Success send gas coins: ${res.digest}`);
    } else {
      Logger.error(res.errors ? res.errors[0] : "Error occurred");
    }
  } catch (e) {
    console.error
  }
};

const createCounterObject = async (suiKit: SuiKit) => {
  const tx = new SuiTxBlock();
  tx.setSender(suiKit.currentAddress());

  SpamTxBuilder.new_user_counter(tx);
  const txBuildBytes = await tx.txBlock.build({
    client: suiKit.client(),
    protocolConfig: await getProtocolConfig(),
  });
  const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
  // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
  const res = await suiKit.client().executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: {
      showEffects: true,
    },
  });
  if (res.effects?.status.status === "success") {
    Logger.success(`Success create counter: ${res.digest}`);
  } else {
    Logger.error(res.errors ? res.errors[0] : "Error occurred");
  }
};

const getCounterObject = async (suiKit: SuiKit, id?: string) => {
  // create new counter if not exists
  const get = async () => {
    if(!id) {
      const counters = await suiKit.client().getOwnedObjects({
        owner: suiKit.currentAddress(),
        filter: {
          MatchAny: [
            {
              StructType: "0x30a644c3485ee9b604f52165668895092191fcaf5489a846afa7fc11cdb9b24a::spam::UserCounter",
            },
          ],
        },
        limit: 1,
      });
      return counters.data.length > 0 ? counters.data[0].data : null;
    } else {
      const counter = await suiKit.client().getObject({
        id,
        options: {
          showContent: true,
          showPreviousTransaction: true
        }
      });
      if(!counter.data) throw new Error(`Failed to get counter object with id ${id}`);
      
      return counter.data;
    }
  };

  const existing = await get();
  if (existing) return existing;

  await createCounterObject(suiKit);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const newCounter = await get();
  if (newCounter) return newCounter;

  throw new Error("Failed to create counter object");
};

const main = async () => {
  const targetAddresses = [];
  try {
    const suiKits: SuiKit[] = Array(batchSize).fill(null);
    const counters: SuiObjectData[] = Array(batchSize).fill(null);

    for (let i = 0; i < batchSize; i++) {
      suiKits[i] = new SuiKit({
        fullnodeUrls: [...MAIN_NODES],
        mnemonics,
        // secretKey: parsedSecretKey!,
      });
      suiKits[i].switchAccount({ accountIndex: i });

      // check for gas coin
      // i = 0 is the main account
      if (i > 0) {
        const gasCoin = await suiKits[i].getBalance(SUI_TYPE_ARG);
        console.log(
          `${suiKits[i].currentAddress()} has ${BigNumber(gasCoin.totalBalance)
            .shiftedBy(-1 * 9)
            .toNumber()} SUI`
        );
        if (
          gasCoin.totalBalance === "0" ||
          BigNumber(gasCoin.totalBalance)
            .shiftedBy(-1 * 9)
            .lt(0.1)
        ) {
          targetAddresses.push(suiKits[i].currentAddress());
        }
      }
      shuffle(MAIN_NODES);
    }

    console.log(targetAddresses);
    Logger.info("-".repeat(80));
    Logger.info(`Running with ${batchSize} accounts`);

    if (targetAddresses.length > 0) {
      Logger.info(`Requesting gas coin for addresses: ${targetAddresses.join(", ")}`);
      // await requestGasCoin(suiKits[0], targetAddresses);
    }

    // create counter objects
    let tasks = [];
    for (let i = 0; i < suiKits.length; i++) {
      tasks.push(async () => {
        const counter = await getCounterObject(suiKits[i]);
        if (!counter) throw new Error("Failed to get counter object");
        counters[i] = counter;
      })
    }
    await Promise.all(tasks.map((t) => t()));
    tasks = [];

    await getProtocolConfig();

    let cnt = 0;
    let results = [];
    let limit = 0;

    while (limit === 0) {
      for (let i = 0; i < suiKits.length; i++) {
        tasks.push(Promise.race([executeSpam(suiKits[i], counters[i]), timeout(30000)]));
      }
      try {
        results = await Promise.allSettled(tasks);
        for(let i = 0; i < results.length; i++) {
          if(results[i].status === "fulfilled") {
            // update counter object
            counters[i] = await getCounterObject(suiKits[i], counters[i].objectId);
          }
        }
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        tasks = [];
        results = [];
      }

      cnt++;
      if (cnt > 5) {
        // reset protocol config
        protocolConfig = null;
        await getProtocolConfig();
        try {
          if (!(await mergeCoins())) {
            throw new Error("Failed to merge coins");
          }
        } finally {
          await splitGasCoins();
          gasCoins = (await getAllCoin(suiKit, suiKit.currentAddress(), SUI_TYPE_ARG)).filter((coin) => {
            const amount = BigNumber(coin.balance).shiftedBy(-1 * 9);
            return amount.gte(0.1);
          });
        }
        cnt = 0;
      }
      limit++;
    }
  } catch (e) {
    Logger.error(JSON.stringify(e));
  }
  return;
};

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => process.exit(0));
