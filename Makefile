.DEFAULT_GOAL := help

PUSH ?= 1

.PHONY: help release rc

help:
	@printf '%s\n' \
		'make release         Start the next patch RC, commit, tag, and push' \
		'make rc              Increment the current RC, commit, tag, and push' \
		'make release PUSH=0  Prepare the next patch RC commit and tag locally' \
		'make rc PUSH=0       Prepare the next RC commit and tag locally'

release:
	node scripts/bumpversion.cjs patch $(if $(filter 1,$(PUSH)),--push)

rc:
	node scripts/bumpversion.cjs rc $(if $(filter 1,$(PUSH)),--push)
