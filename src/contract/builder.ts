import { SuiObjectArg, SuiTxBlock } from "@scallop-io/sui-kit";
import { DirectorObjectId, SpamContract } from "./contract";

export const SpamTxBuilder = {
  increment_counter: (tx: SuiTxBlock, userCounter: SuiObjectArg) => {
    return tx.moveCall(
      `${SpamContract.id}::spam::increment_user_counter`,
      [userCounter],
      []
    )
  },
  new_user_counter: (tx: SuiTxBlock) => {
    return tx.moveCall(
      `${SpamContract.id}::spam::new_user_counter`,
      [DirectorObjectId],
      []
    )
  },
  // claim_reward: (tx: SuiTxBlock, userCounter: SuiObjectArg) => {
  //   return tx.moveCall(
  //     `${SpamContract.id}::spam::claim_reward`,
  //   )
  // }
}