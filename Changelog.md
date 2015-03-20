# Change Log

## v0.0.7 (2015-03-20)
* [Message] `body` default to `null`

## v0.0.6 (2015-03-20)
* [Message] fixed `body` in constructor

## v0.0.5 (2015-03-20)
* [Message] fixed `.fromRawMessage` headers

## v0.0.4 (2015-03-19)
* [Message]
    - `.reject(options)` changed from `.reject(channel, options)`, `options` supports `multiple` and `requeue`. uses channel.nack instead of `channel.reject`
    - `.requeue()` uses `channel.nack` instead of `channel.reject`
* [Connection]
    - removed #getDefaultChannel() method
