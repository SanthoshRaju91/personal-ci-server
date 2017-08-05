# CI Server

This is pet project, which would allow you to have your own CI instance running on your server. For now it is not completely configurable. 

And this would need you to have a webhook configured to your project repo.

If your are running on the server, you would need to configure the server URL with the webhook of your project.
If your running on your local machine, then you would need to expose your web server on the internet. So the webhook can fire events. Best possible way is to have ngrock configured on your machine.

### TODO

1. Creating a user interface, so that the user can configure, view jobs, check logs, rerun a job.
2. To create webhook, once the user interface is created. A config screen should be shown if it is for the first time.
3. Have a authentication sytem, for the making the configurations.
4. Getting the mongoDB database to store the job details, as there is no logging system currently.
