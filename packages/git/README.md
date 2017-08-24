This is a Cardstack data source plugin for reading and writing to Git.

Building native nodegit dep on osx
--------------------------------

You need the latest Xcode *and* you need to manually tell it to get the latest CLI tools via

    sudo xcode-select --install
    
Merely upgrading Xcode will still leave you broken and frustrated.

I cloned and built nodegit in its own repo, and then used `yarn link`. This seems to function as insurance against `yarn` deciding to rebuild it from scratch (which takes a long time).
