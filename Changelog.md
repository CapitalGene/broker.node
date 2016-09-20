# Change Log

## v0.0.11 (2016-09-20)
* 1324f6ec fixed test `.delay`
* 9d6929f9 **Deps**: use `amqp-node`


## v0.0.10
* **.eslintrc** update
* added .esformatter
* **deps**: chai^3.2.0
* added .gitlab-ci.yml

## v0.0.9
* `chai-as-promised@5.0.0`
* *Producer#publish* supports `options.headers`

## v0.0.8
* [Connection] takes `options.transportOptions`

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
