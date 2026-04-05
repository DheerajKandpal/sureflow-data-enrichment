"""
server/config_lock.py
=====================
Single shared RLock for all config.yaml reads and writes.

Why RLock (reentrant) instead of Lock:
  The same thread may call load_config() inside a route that itself
  holds the lock (e.g. add_token reads then writes). RLock allows the
  same thread to acquire the lock multiple times without deadlocking.

Usage:
    from server.config_lock import CONFIG_LOCK

    with CONFIG_LOCK:
        config = yaml.safe_load(open("config.yaml"))

    with CONFIG_LOCK:
        yaml.dump(config, open("config.yaml", "w"))
"""

import threading

CONFIG_LOCK = threading.RLock()