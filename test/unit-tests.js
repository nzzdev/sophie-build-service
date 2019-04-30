const Lab = require("@hapi/lab");
const Code = require("@hapi/code");
const lab = (exports.lab = Lab.script());

const expect = Code.expect;
const before = lab.before;
const after = lab.after;
const it = lab.it;

let server = require("./server.js").getServer();
const plugins = require("./plugins.js");

before(async () => {
  try {
    await server.register(plugins);
    await server.start();
  } catch (err) {
    expect(err).to.not.exist();
  }
});

after(async () => {
  await server.stop({ timeout: 2000 });
  server = null;
});

lab.experiment("sophie-bundle", () => {
  it("parses bundleId correctly", { plan: 10 }, () => {
    const packages = server.methods.sophie.bundle.getPackagesFromBundleId(
      "module1@^1,module2@^2.2[sub1],module3@^3.3.3[sub1+sub2]"
    );
    expect(packages[0].name).to.be.equal("module1");
    expect(packages[0].submodules).to.be.undefined();
    expect(packages[0].version).to.be.equal("^1");
    expect(packages[1].name).to.be.equal("module2");
    expect(packages[1].submodules[0]).to.be.equal("sub1");
    expect(packages[1].version).to.be.equal("^2.2");
    expect(packages[2].name).to.be.equal("module3");
    expect(packages[2].submodules[0]).to.be.equal("sub1");
    expect(packages[2].submodules[1]).to.be.equal("sub2");
    expect(packages[2].version).to.be.equal("^3.3.3");
  });

  it(
    "generates correct bundleId from package information with versions",
    { plan: 1 },
    () => {
      const bundleId =
        "module1%23master,module2@2.2[sub1],module3@3.3.3[sub1+sub2]";
      const packages = server.methods.sophie.bundle.getPackagesFromBundleId(
        bundleId
      );
      const generatedBundleId = server.methods.sophie.bundle.getBundleIdFromPackages(
        packages
      );
      expect(generatedBundleId).to.be.equal(bundleId.replace("%23", "#"));
    }
  );

  it(
    "generates correct bundleId from package information with branches with encoded hash",
    { plan: 1 },
    () => {
      const bundleId =
        "module1#master,module2#dev[sub1],module3#feat-branch[sub1+sub2]";
      const packages = server.methods.sophie.bundle.getPackagesFromBundleId(
        "module1#master,module2#dev[sub1],module3#feat-branch[sub1+sub2]"
      );
      const generatedBundleId = server.methods.sophie.bundle.getBundleIdFromPackages(
        packages
      );
      expect(generatedBundleId).to.be.equal(bundleId);
    }
  );

  it(
    "generates correct bundleId from package information with branches with hash",
    { plan: 1 },
    () => {
      const bundleId =
        "module1#master,module2#dev[sub1],module3#feat-branch[sub1+sub2]";
      const packages = server.methods.sophie.bundle.getPackagesFromBundleId(
        "module1#master,module2#dev[sub1],module3#feat-branch[sub1+sub2]"
      );
      const generatedBundleId = server.methods.sophie.bundle.getBundleIdFromPackages(
        packages
      );
      expect(generatedBundleId).to.be.equal(bundleId);
    }
  );

  it(
    "generates correct bundleId from package information with branches with hash encoded/unencoded mixed",
    { plan: 1 },
    () => {
      const bundleId =
        "module1#master,module2#dev[sub1],module3#feat-branch[sub1+sub2]";
      const packages = server.methods.sophie.bundle.getPackagesFromBundleId(
        "module1#master,module2#dev[sub1],module3#feat-branch[sub1+sub2]"
      );
      const generatedBundleId = server.methods.sophie.bundle.getBundleIdFromPackages(
        packages
      );
      expect(generatedBundleId).to.be.equal(bundleId);
    }
  );

  it("failes to generate bundleId from wrong bundleId", { plan: 1 }, () => {
    const bundleId = "module1*master";
    const packages = server.methods.sophie.bundle.getPackagesFromBundleId(
      bundleId
    );
    const generatedBundleId = server.methods.sophie.bundle.getBundleIdFromPackages(
      packages
    );
    expect(generatedBundleId).to.be.equal("");
  });
});
