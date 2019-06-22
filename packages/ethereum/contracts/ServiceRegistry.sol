pragma solidity ^0.4.18;

contract ServiceRegistry {

  event Registered(
    bytes32 userid,
    address serviceProvider
  );

  event Unregistered(
    bytes32 userid,
    address serviceProvider
  );

  mapping(bytes32 => mapping(address => bool)) public registrations;

  function registerServiceProvider(bytes32 userid, address serviceProvider) public {
    registrations[userid][serviceProvider] = true;

    emit Registered(userid, serviceProvider);
  }

  function unregisterServiceProvider(bytes32 userid, address serviceProvider) public {
    registrations[userid][serviceProvider] = false;
    emit Unregistered(userid, serviceProvider);
  }

  function isActiveServiceProvider(bytes32 userid, address serviceProvider) public view returns (bool status) {
    status = registrations[userid][serviceProvider];
  }
}

