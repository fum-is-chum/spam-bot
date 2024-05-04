### SPAM MULTI ACC BOT
Multi Wallet Account bot for $SPAM.

This script will create `BATCH_SIZE` wallets from your mnemonic and use all the accounts to spam.

How to use:
- Add your mnemonic to `.env`
- Supply $SUI to the first account from the mnemonic wallet
- Adjust `BATCH_SIZE` in `.env` for multiple wallet accounts (5 = 5 wallet accounts)
- Adjust `ITER` in `.env` for iterations (100 = 100txns per wallet account)