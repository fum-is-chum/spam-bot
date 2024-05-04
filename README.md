## $SPAM MULTI ACC BOT
[More about $SPAM](https://spamsui.com/spam)

Script for automating and running spam bot with multi wallets
This script will create `BATCH_SIZE` wallets from your mnemonic and use all the accounts to spam.

How to use:
- Add your mnemonic to `.env`
- Supply $SUI to the first account from the mnemonic wallet
- Adjust `BATCH_SIZE` in `.env` for multiple wallet accounts (5 = 5 wallet accounts)
- Adjust `ITER` in `.env` for iterations (100 = 100txns per wallet account)

## DISCLAIMER
This script is just for fun and learning purpose. There is no audits nor fully proper testings yet. Use it with your own risk