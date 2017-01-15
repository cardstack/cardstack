# -*- mode: ruby -*-
# vi: set ft=ruby :

VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "bento/ubuntu-16.04"
  config.vm.hostname = "cardstack-server"

  private_ip = "10.0.15.2"

  config.vm.network "private_network", ip: private_ip

  config.vm.provider "virtualbox" do |v|
    v.memory = 4096
    v.cpus = 2
  end


  if File.exists? "./scripts/root_environment.sh"
    config.vm.provision :shell do |shell|
      shell.path = "./scripts/root_environment.sh"
      shell.args = [
        private_ip
      ]
    end
  end

  if File.exists? "./scripts/user_environment.sh"
    config.vm.provision :shell do |shell|
      shell.privileged = false
      shell.path = "./scripts/user_environment.sh"
    end
  end

end
