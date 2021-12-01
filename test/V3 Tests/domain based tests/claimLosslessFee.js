/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-destructuring */
const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const path = require('path');
const { setupAddresses, setupEnvironment, setupToken } = require('../utilsV3');

let adr;
let env;

const scriptName = path.basename(__filename, '.js');

const reportedAmount = 1000000;
const losslessReward = 0.1;

describe(scriptName, () => {
  beforeEach(async () => {
    adr = await setupAddresses();
    env = await setupEnvironment(adr.lssAdmin,
      adr.lssRecoveryAdmin,
      adr.lssPauseAdmin,
      adr.lssInitialHolder,
      adr.lssBackupAdmin);
    lerc20Token = await setupToken(2000000,
      'Random Token',
      'RAND',
      adr.lerc20InitialHolder,
      adr.lerc20Admin.address,
      adr.lerc20BackupAdmin.address,
      Number(time.duration.days(1)),
      env.lssController.address);

    await env.lssController.connect(adr.lssAdmin).setWhitelist([env.lssReporting.address], true);
    await env.lssController.connect(adr.lssAdmin).setDexList([adr.dexAddress.address], true);

    await env.lssToken.connect(adr.lssInitialHolder)
      .transfer(adr.reporter1.address, env.stakingAmount);
    await lerc20Token.connect(adr.lerc20InitialHolder).transfer(adr.maliciousActor1.address, reportedAmount);

    await env.lssToken.connect(adr.reporter1).approve(env.lssReporting.address, env.stakingAmount);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.minutes(5)),
    ]);

    await env.lssReporting.connect(adr.reporter1)
      .report(lerc20Token.address, adr.maliciousActor1.address);

    await env.lssGovernance.connect(adr.lssAdmin).addCommitteeMembers([
      adr.member1.address,
      adr.member2.address,
      adr.member3.address,
      adr.member4.address,
      adr.member5.address]);

    await env.lssGovernance.connect(adr.lssAdmin).losslessVote(1, true);
    await env.lssGovernance.connect(adr.lerc20Admin).tokenOwnersVote(1, true);
    await env.lssGovernance.connect(adr.member1).committeeMemberVote(1, true);
    await env.lssGovernance.connect(adr.member2).committeeMemberVote(1, true);
    await env.lssGovernance.connect(adr.member3).committeeMemberVote(1, true);
    await env.lssGovernance.connect(adr.member4).committeeMemberVote(1, true);

    await env.lssGovernance.connect(adr.lssAdmin).resolveReport(1);

    await ethers.provider.send('evm_increaseTime', [
      Number(time.duration.minutes(1)),
    ]);
  });

  describe('when lossless team claims', () => {
    it('should not revert', async () => {
      let balance;
      expect(
        (balance = await lerc20Token.balanceOf(adr.lssAdmin.address)),
      ).to.be.equal(0);

      await env.lssStaking.connect(adr.lssAdmin).losslessClaim(1);

      expect(await lerc20Token.balanceOf(adr.lssAdmin.address)).to.be.equal(
        reportedAmount * losslessReward,
      );
    });
  });

  describe('when lossless team claims two times', () => {
    it('should revert', async () => {
      await env.lssStaking.connect(adr.lssAdmin).losslessClaim(1);

      await expect(
        env.lssStaking.connect(adr.lssAdmin).losslessClaim(1),
      ).to.be.revertedWith('LSS: Already claimed');
    });
  });

  describe('when lossless claim is called by not lossless admin two times', () => {
    it('should revert', async () => {
      await expect(
        env.lssStaking.connect(adr.reporter1).losslessClaim(1),
      ).to.be.revertedWith('LSS: Must be admin');
    });
  });
});
