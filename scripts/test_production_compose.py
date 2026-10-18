"""Prevent production database exposure and restart-policy regressions."""

import unittest

from scripts.check_production_compose import validate_production_compose


class ProductionComposeSecurityTests(unittest.TestCase):
    def config(self, host_ip=None, *, publish=True):
        database = {"restart": "unless-stopped"}
        if publish:
            binding = {"target": 5432, "published": "5432", "protocol": "tcp"}
            if host_ip is not None:
                binding["host_ip"] = host_ip
            database["ports"] = [binding]
        return {"services": {"db": database}}

    def test_database_without_published_ports_is_safe(self):
        self.assertEqual(validate_production_compose(self.config(publish=False)), [])

    def test_ipv4_and_ipv6_loopback_bindings_are_safe(self):
        for address in ("127.0.0.1", "127.0.0.2", "::1"):
            with self.subTest(address=address):
                self.assertEqual(validate_production_compose(self.config(address)), [])

    def test_public_and_wildcard_bindings_are_rejected(self):
        for address in (None, "0.0.0.0", "::", "192.0.2.10", "10.0.0.1", "invalid"):
            with self.subTest(address=address):
                self.assertTrue(validate_production_compose(self.config(address)))

    def test_one_public_binding_cannot_hide_behind_a_safe_binding(self):
        config = self.config("127.0.0.1")
        config["services"]["db"]["ports"].append({"target": 5432, "published": "5433"})
        self.assertTrue(validate_production_compose(config))

    def test_host_networking_is_rejected_even_without_published_ports(self):
        config = self.config(publish=False)
        config["services"]["db"]["network_mode"] = "host"
        self.assertTrue(validate_production_compose(config))

    def test_database_must_restart_after_reboot(self):
        for policy in (None, "no", "on-failure"):
            with self.subTest(policy=policy):
                config = self.config("127.0.0.1")
                config["services"]["db"]["restart"] = policy
                self.assertTrue(validate_production_compose(config))

    def test_missing_database_or_invalid_services_are_rejected(self):
        for config in (None, [], {}, {"services": []}, {"services": {"db": None}}):
            with self.subTest(config=config):
                self.assertTrue(validate_production_compose(config))

    def test_unnormalized_ports_are_rejected(self):
        for ports in (None, "5432:5432", [5432], ["127.0.0.1:5432:5432"]):
            with self.subTest(ports=ports):
                config = self.config(publish=False)
                config["services"]["db"]["ports"] = ports
                self.assertTrue(validate_production_compose(config))


if __name__ == "__main__":
    unittest.main()
