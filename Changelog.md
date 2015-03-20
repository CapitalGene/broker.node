# Change Log

## v0.0.5 (2015-03-20)
* [Message] fixed `.fromRawMessage` headers

## v0.0.4 (2015-03-19)
* [Message]
    - `.reject(options)` changed from `.reject(channel, options)`, `options` supports `multiple` and `requeue`. uses channel.nack instead of `channel.reject`
    - `.requeue()` uses `channel.nack` instead of `channel.reject`
* [Connection]
    - removed #getDefaultChannel() method
