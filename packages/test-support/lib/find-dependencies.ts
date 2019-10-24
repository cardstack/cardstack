import { join } from "path";
import glob from "glob";

interface PackageJSON {
  name: string;
  dependencies?: { [name: string]: string };
  devDependencies?: { [name: string]: string };
}

function loadPackages() {
  let packages = glob.sync("./packages/*/package.json").map(p => {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    return require(join(process.cwd(), p)) as PackageJSON;
  });
  let result: Map<string, PackageJSON> = new Map();
  for (let pkg of packages) {
    result.set(pkg.name, pkg);
  }
  return result;
}

function deps(pkg: PackageJSON) {
  let result: Set<string> = new Set();

  if (pkg.dependencies) {
    for (let dep of Object.keys(pkg.dependencies)) {
      result.add(dep);
    }
  }
  if (pkg.devDependencies) {
    for (let dep of Object.keys(pkg.devDependencies)) {
      result.add(dep);
    }
  }

  return result;
}

export default function findDependencies(startPackage: string) {
  let packages = loadPackages();

  let pkg = packages.get(startPackage);
  if (!pkg) {
    throw new Error(`${startPackage} not found`);
  }

  let used: Set<PackageJSON> = new Set();
  crawl(pkg, packages, used);
  return [...used].map(p => p.name);
}

function crawl(pkg: PackageJSON, packages: Map<string, PackageJSON>, used: Set<PackageJSON>) {
  if (used.has(pkg)) {
    return;
  }
  used.add(pkg);
  for (let dep of deps(pkg)) {
    let depPkg = packages.get(dep);
    if (depPkg) {
      crawl(depPkg, packages, used);
    }
  }
}
