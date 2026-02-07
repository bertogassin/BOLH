import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BOLH } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("BOLH Token v2", function () {
  let bolh: BOLH;
  let owner: SignerWithAddress;
  let community: SignerWithAddress;
  let team: SignerWithAddress;
  let liquidity: SignerWithAddress;
  let reserve: SignerWithAddress;
  let marketing: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1B
  const COMMUNITY_AMOUNT = ethers.parseEther("400000000"); // 400M
  const TEAM_AMOUNT = ethers.parseEther("200000000"); // 200M
  const LIQUIDITY_AMOUNT = ethers.parseEther("150000000"); // 150M
  const RESERVE_AMOUNT = ethers.parseEther("150000000"); // 150M
  const MARKETING_AMOUNT = ethers.parseEther("100000000"); // 100M

  beforeEach(async function () {
    [owner, community, team, liquidity, reserve, marketing, alice, bob] =
      await ethers.getSigners();

    const BOLH = await ethers.getContractFactory("BOLH");
    bolh = (await upgrades.deployProxy(
      BOLH,
      [community.address, team.address, liquidity.address, reserve.address, marketing.address],
      { kind: "uups" }
    )) as unknown as BOLH;
  });

  describe("Deployment & Distribution", function () {
    it("should have correct name, symbol, and version", async function () {
      expect(await bolh.name()).to.equal("BOLH");
      expect(await bolh.symbol()).to.equal("BOLH");
      expect(await bolh.version()).to.equal("2.0.0");
    });

    it("should mint 1B total supply", async function () {
      expect(await bolh.totalSupply()).to.equal(TOTAL_SUPPLY);
    });

    it("should distribute 40% to community", async function () {
      expect(await bolh.balanceOf(community.address)).to.equal(COMMUNITY_AMOUNT);
    });

    it("should lock 20% team tokens in contract", async function () {
      const contractBalance = await bolh.balanceOf(await bolh.getAddress());
      expect(contractBalance).to.equal(TEAM_AMOUNT);
    });

    it("should distribute 15% to liquidity", async function () {
      expect(await bolh.balanceOf(liquidity.address)).to.equal(LIQUIDITY_AMOUNT);
    });

    it("should distribute 15% to reserve", async function () {
      expect(await bolh.balanceOf(reserve.address)).to.equal(RESERVE_AMOUNT);
    });

    it("should distribute 10% to marketing", async function () {
      expect(await bolh.balanceOf(marketing.address)).to.equal(MARKETING_AMOUNT);
    });
  });

  describe("Team Vesting", function () {
    it("should have 0 claimable during lock period", async function () {
      expect(await bolh.teamClaimable()).to.equal(0);
    });

    it("should have 0 claimable at exactly 1 year", async function () {
      await time.increase(365 * 24 * 3600 - 1);
      expect(await bolh.teamClaimable()).to.equal(0);
    });

    it("should vest linearly after lock period", async function () {
      // Skip lock (1 year) + half vest (1 year) = 2 years
      await time.increase(365 * 24 * 3600 + 365 * 24 * 3600);
      const claimable = await bolh.teamClaimable();
      // Should be ~50% of team allocation
      const expected = TEAM_AMOUNT / 2n;
      const tolerance = ethers.parseEther("1000"); // small tolerance for block time
      expect(claimable).to.be.closeTo(expected, tolerance);
    });

    it("should allow team to claim vested tokens", async function () {
      await time.increase(365 * 24 * 3600 + 365 * 24 * 3600); // 2 years
      await bolh.connect(team).claimTeamTokens();
      const teamBalance = await bolh.balanceOf(team.address);
      expect(teamBalance).to.be.gt(0);
    });

    it("should not allow non-team to claim", async function () {
      await time.increase(365 * 24 * 3600 * 3); // 3 years
      await expect(bolh.connect(alice).claimTeamTokens()).to.be.revertedWith(
        "BOLH: not team wallet"
      );
    });

    it("should fully vest after lock + vest duration", async function () {
      await time.increase(365 * 24 * 3600 + 730 * 24 * 3600 + 1); // 1y lock + 2y vest
      const claimable = await bolh.teamClaimable();
      expect(claimable).to.equal(TEAM_AMOUNT);
    });
  });

  describe("Anti-Whale", function () {
    it("should block transfers exceeding max", async function () {
      // First send some tokens to alice (non-exempt), then alice tries to send too much
      await bolh.connect(community).transfer(alice.address, ethers.parseEther("4000000"));
      const tooMuch = ethers.parseEther("4000000"); // 4M > 0 but alice has no exemption
      // Now alice sends to bob — both non-exempt, max is 0.5% of 1B = 5M
      // Send alice more so she can exceed
      await bolh.connect(community).transfer(alice.address, ethers.parseEther("4000000"));
      // alice has 8M, tries to send 6M (> 5M limit)
      await expect(
        bolh.connect(alice).transfer(bob.address, ethers.parseEther("6000000"))
      ).to.be.revertedWith("BOLH: exceeds max transfer");
    });

    it("should allow transfers within limit", async function () {
      await bolh.connect(community).transfer(alice.address, ethers.parseEther("4000000"));
      // alice sends 4M to bob (under 5M limit, both non-exempt)
      await bolh.connect(alice).transfer(bob.address, ethers.parseEther("3000000"));
      expect(await bolh.balanceOf(bob.address)).to.equal(ethers.parseEther("3000000"));
    });

    it("should allow owner to disable anti-whale", async function () {
      await bolh.connect(community).transfer(alice.address, ethers.parseEther("4000000"));
      await bolh.connect(community).transfer(alice.address, ethers.parseEther("4000000"));
      await bolh.setAntiWhale(false, 0);
      // Now alice can send any amount
      await bolh.connect(alice).transfer(bob.address, ethers.parseEther("8000000"));
      expect(await bolh.balanceOf(bob.address)).to.equal(ethers.parseEther("8000000"));
    });
  });

  describe("Blacklist", function () {
    it("should block blacklisted sender", async function () {
      await bolh.connect(community).transfer(alice.address, ethers.parseEther("1000"));
      await bolh.setBlacklisted(alice.address, true);
      await expect(
        bolh.connect(alice).transfer(bob.address, ethers.parseEther("500"))
      ).to.be.revertedWith("BOLH: sender blacklisted");
    });

    it("should block transfer to blacklisted address", async function () {
      await bolh.setBlacklisted(bob.address, true);
      await expect(
        bolh.connect(community).transfer(bob.address, ethers.parseEther("100"))
      ).to.be.revertedWith("BOLH: recipient blacklisted");
    });

    it("should not allow blacklisting owner", async function () {
      await expect(
        bolh.setBlacklisted(owner.address, true)
      ).to.be.revertedWith("BOLH: cannot blacklist owner");
    });
  });

  describe("Pausable", function () {
    it("should pause and block transfers", async function () {
      await bolh.pause();
      await expect(
        bolh.connect(community).transfer(alice.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(bolh, "EnforcedPause");
    });

    it("should unpause and allow transfers", async function () {
      await bolh.pause();
      await bolh.unpause();
      await bolh.connect(community).transfer(alice.address, ethers.parseEther("100"));
      expect(await bolh.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Burn", function () {
    it("should burn and reduce supply", async function () {
      const burnAmount = ethers.parseEther("1000000"); // 1M
      await bolh.connect(community).burn(burnAmount);
      expect(await bolh.totalSupply()).to.equal(TOTAL_SUPPLY - burnAmount);
    });
  });

  describe("Upgradeable", function () {
    it("should be upgradeable by owner", async function () {
      const BOLHv2 = await ethers.getContractFactory("BOLH");
      const upgraded = await upgrades.upgradeProxy(await bolh.getAddress(), BOLHv2);
      expect(await upgraded.version()).to.equal("2.0.0");
      // Balances preserved
      expect(await upgraded.balanceOf(community.address)).to.equal(COMMUNITY_AMOUNT);
    });
  });
});
