REPORTER=spec
MOCHA?=./node_modules/.bin/mocha
check: test
test:
	@NODE_ENV=testing \
	BLUEBIRD_DEBUG=1 \
	$(MOCHA) \
		--reporter $(REPORTER)

test-debug:
	@NODE_ENV=testing \
	BLUEBIRD_DEBUG=1 \
	$(MOCHA) \
		--reporter $(REPORTER) --debug-brk

.PHONY: test test-debug
