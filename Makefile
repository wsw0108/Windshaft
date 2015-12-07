SHELL=/bin/bash

pre-install:
	@$(SHELL) ./scripts/check-node-canvas.sh

all:
	@$(SHELL) ./scripts/install.sh

clean:
	@rm -rf node_modules/*

check: test

TEST_SUITE := $(shell find test/{acceptance,unit} -name "*.js")
TEST_SUITE_UNIT := $(shell find test/unit -name "*.js")
TEST_SUITE_ACCEPTANCE := $(shell find test/acceptance -name "*.js")

test:
	@echo "***tests***"
	@$(SHELL) ./run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE)

test-acceptance:
	@echo "***acceptance tests***"
	@$(SHELL) ./run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE_ACCEPTANCE)

test-unit:
	@echo "***unit tests***"
	@$(SHELL) ./run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE_UNIT)

jshint:
	@echo "***jshint***"
	@./node_modules/.bin/jshint lib/ test/

test-all: jshint test

coverage:
	@RUNTESTFLAGS=--with-coverage make test

.PHONY: pre-install test jshint coverage
