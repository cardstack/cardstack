def compare(dict, o, ignored_keys=[]):
    for key in dict.keys():
        if key not in ignored_keys:
            assert dict[key] == getattr(o, key)
