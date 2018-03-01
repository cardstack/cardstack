const SampleToken = artifacts.require("./SampleToken.sol");

contract('SampleToken', function(accounts) {
  it("should mint SampleToken in the token owner account", async function() {
    let instance = await SampleToken.new();
    await instance.mint(accounts[0], 10000);
    let balance = await instance.balanceOf(accounts[0]);

    assert.equal(balance.toNumber(), 10000, "the owner account balance is correct");
  });

  it("should transfer the token", async function() {
    // Get initial balances of first and second account.
    let account_one = accounts[0];
    let account_two = accounts[1];

    let amount = 10;

    let token = await SampleToken.new();
    await token.mint(account_one, 100);
    let account_one_starting_balance = await token.balanceOf(account_one);
    account_one_starting_balance = account_one_starting_balance.toNumber();

    let account_two_starting_balance = await token.balanceOf(account_two);
    account_two_starting_balance = account_two_starting_balance.toNumber();

    let txn = await token.transfer(account_two, amount, {from: account_one});
    let account_one_ending_balance = await token.balanceOf(account_one);
    account_one_ending_balance = account_one_ending_balance.toNumber();
    let account_two_ending_balance = await token.balanceOf(account_two);
    account_two_ending_balance = account_two_ending_balance.toNumber();

    assert.equal(account_one_ending_balance, account_one_starting_balance - amount, "Amount wasn't correctly taken from the sender");
    assert.equal(account_two_ending_balance, account_two_starting_balance + amount, "Amount wasn't correctly sent to the receiver");

    assert.equal(txn.logs.length, 1, "there is one event fired");
    assert.equal(txn.logs[0].event, "Transfer", "A transfer event is fired");
    assert.equal(txn.logs[0].args.from, account_one, "the sender address is correct");
    assert.equal(txn.logs[0].args.to, account_two, "the sender address is correct");
    assert.equal(txn.logs[0].args.value, amount, "the amount of tokens is correct");
  });
});

