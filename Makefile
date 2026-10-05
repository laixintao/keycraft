.DEFAULT_GOAL := help

PUSH ?= 1
export VERSION

.PHONY: help dmg release rc

help:
	@printf '%s\n' \
		'make dmg             Build a local DMG installer' \
		'make release         Start the next patch RC, commit, tag, and push' \
		'make release VERSION=0.5.0-rc.1  Publish a specific newer RC' \
		'make rc              Increment the current RC, commit, tag, and push' \
		'make release PUSH=0  Prepare the next patch RC commit and tag locally' \
		'make rc PUSH=0       Prepare the next RC commit and tag locally'

dmg:
	./scripts/build-dmg.sh

release:
	node scripts/bumpversion.cjs patch $(if $(filter 1,$(PUSH)),--push)

rc:
	node scripts/bumpversion.cjs rc $(if $(filter 1,$(PUSH)),--push)
