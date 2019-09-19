# Pulse

Taskcluster uses RabbitMQ to communicate between microservices.
The particular approach it takes to this communication is called "Pulse", taken from a larger project at Mozilla, but it can run against any RabbitMQ deployment, either local or hosted by a commercial provider.

See [/docs/manual/design/apis/pulse](the Pulse design page) for information on how Taskcluster expects this to be configured.
This is satisfied by a mostly-default RabbitMQ installation.

Most services require service-specific credentials for access to Pulse.

## Details

Taskcluster is particularly sensitive to the AMQP `frame_max` parameter.
It must fit all the "routes" for a task into the header of an AMQP message, and the header must fit in a single frame.
RabbitMQ's default frame_max is 128k, and other AMQP servers should be configured similarly.
