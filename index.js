import http from 'http';
import webhook from 'github-webhook-handler';
import shell from 'shelljs';
import fs from 'fs';
import { Client } from 'node-rest-client';
import config from './config';

const { PORT, accessToken, webhookPath, secret } = config;

/** client instance for communicating with github REST API**/
let client = new Client();

/** git hub webhook handler **/
let handler = webhook({ path: `/${webhookPath}`, secret: secret });


/**
* Creating webhook for the specified github repo
*/
async function createWebhook(repo, url) {
  let args = {
    data: {
      'name': webhookPath,
      'active': true,
      'events': ['push', 'pull_request'],
      'config': {
        'url': url,
        'content_type': 'json',
        'secret': secret
      }
    },
    headers: {
      'User-Agent': 'request',
      'Content-Type': 'application/json',
      'X-Hub-Signature': 'request'
    }
  };

  return new Promise((resolve, reject) => {
    client.post(`${repo}?access_token=${accessToken}`, args, (data, response) => {
      if(data) {
        console.log('Created webhook');
        console.log(data);
        resolve(data);
      } else {
        console.error(`Error on creating webhook: ${response.body}`);
        reject();
      }
    });
  });
};

/**
* Async function for updating the statues for the github repo, for a Pull request / individual commit
* it is contextual based on the proc variable 'PR' / 'Commit'
* @method updateStatus
* @param proc - Contextual indicator 'PR' / 'Commit'
* @param repo - github API URL
* @param commit - commit Hash - applicable only for individual commits
* @param status - status object to be sent to the github statues API.
*/
async function updateStatus(proc, repo, status, commit = '') {
  let args = {
    data: {
      'state': status.state,
      'description': status.description
    },

    headers: {
      'User-Agent': 'request',
      'Content-Type': 'application/json'
    }
  };

  /* constructing the repo URL based on the proc mode 'Pull Request' / 'Commit' */
  let repoURL = (proc === 'PR') ? repo : repo.replace('{sha}', commit);

  /* Returing a promise after the posting to status API */
  return new Promise((resolve, reject) => {
    client.post(`${repoURL}?access_token=${accessToken}`,
      args,
      (data, response) => {
          if(data) {
            console.log('Status updated');
            resolve(data);
          } else {
            console.error('Something went wrong');
            reject();
          }
      }
    );
  });
};


/**
* Async function to trigger the build, procedure
* 1. clone the project / pull lastest from the specific commit
* 2. install all its dependencies
* 3. run npm test and return the execution status
* @method makeBuild
* @param cloneURL - github project to clone
* @param cwd - current working directory
*/
function makeBuild(cloneURL, cwd) {
  if(!fs.existsSync(cwd)) {
    shell.mkdir('-p', cwd);
    shell.exec(`git clone ${cloneURL} ${cwd}`);
    shell.cd(cwd);
  } else {
    shell.cd(cwd);
    shell.exec(`git pull`);
  }

  shell.exec(`npm install`);
  return shell.exec(`npm test`);
}

/**
* Async function for triggering the build process for individual commits
* @method buildProcess
* @param repository - github API event object
*/
async function buildProcess(repository) {
  await updateStatus(
    'Commit',
    repository.repository.statuses_url,
    {
      state: 'pending',
      description: 'Running build & tests'
    },
    repository.head_commit.id
    );

  let cwd = `/Users/santhoshraju/Documents/github-node-webhook/PRS/${repository.head_commit.id}`;

  let code = makeBuild(repository.repository.clone_url, cwd);

  let state = (code.code === 1) ? 'failure' : 'success';
  let description = (code.code === 1) ? 'Build & tests failed' : 'Build & test case execution success';

  await updateStatus(
    'Commit',
    repository.repository.statuses_url,
    {
      state,
      description
    },
    repository.head_commit.id
  );
};


/**
* Async function for triggering the build process for pull requests
* @method buildPRProcess
* @param repository - github API event object
*/
async function buildPRProcess(repository) {

  await updateStatus(
    'PR',
    repository.pull_request.statuses_url,
    {
      state: 'pending',
      description: 'Running build & tests'
    });

  let cwd = `/Users/santhoshraju/Documents/github-node-webhook/PRS/${repository.pull_request.head.sha}`;
  let code = makeBuild(repository.pull_request.base.repo.clone_url, cwd);

  let state = (code.code === 1) ? 'failure' : 'success';
  let description = (code.code === 1) ? 'Build & tests failed' : 'Build & test case execution success';

  await updateStatus(
    'PR',
    repository.pull_request.statuses_url,
    {
      state,
      description
    }
  );
};

/**
* Handler for individual commits.
*/
handler.on('push', (event) => {
  buildProcess(event.payload);
});

/**
* Handler for open, close, updates to the Pull Requests
*/
handler.on('pull_request', (event) => {
  buildPRProcess(event.payload);
});




/** Running the server instance **/
http.createServer((req, res) => {
  handler(req, res, err => {
    res.statusCode = 404;
    res.end('No such location exists on github');
  });
})
.listen(PORT, err => {
  if(err) {
    console.log(`Error in listening on port 7777`);
  } else {
    console.log(`Waiting events from webhook`);
    // createWebhook('https://api.github.com/repos/SanthoshRaju91/apollo-node-mongo/hooks', `http://7c77fc79.ngrok.io/${webhookPath}`);
  }
});
