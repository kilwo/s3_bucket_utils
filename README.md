# s3_bucket_utils
Quick utility to help manage AWS S3 buckets

## Basic usage
Enter ./bucket_util to start.

If there are AWS Key and Secret in the current environment (ie. AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set) the tool will use these. If they are not set, the tool will prompt for a profile name that must be defined in the AWS command line tools. 

The tool will load all buckets that can be accessed by the credentials supplied. 

## Commands
? / help - Shows the available commands.

d / delete - Delete the specific bucket. Only valid for empty buckets.

e / empty - Delete all the objects in the bucket. Only valid if the bucket has objects.

l / list - Displays a list of all the objects in the specified bucket. Only valid if the bucket has objects.

r / refresh - Reloads the list of buckets.

q / quit - Duh!

Commands can be entered as either the full command name, or the first letter, followed by the bucket id. If you enter the full command name, you must add a space after the command. If you use the first letter, the space is optional.

Eg:

`list 1`

`e 1`

`d1`


