<script setup>
import Icon from '../components/Icon.vue';
</script>
<template>
    <main id="about">
        <div class="wrapper">
            <h2>About</h2>
            <p class="lead">
                This is a minimal demo of a private chatbot inspired by <a target="_blank" href="https://lumo.proton.me/">Proton Lumo</a> to learn about web security, VPS hosting, serving LLMs.
            </p>
            <p>External links</p>
            <p></p>
            <ul>
                <li class="">
                    <a target="_blank" href="https://github.com/fpstidston">
                        Code repository
                    </a>
                </li>
                <li class="">
                    <a target="_blank" href="https://katapult.io/">
                        Cloud provider
                    </a>
                </li>
            </ul>
            <p>On this page</p>
            <ul>
                <li class="">
                    <a href="#policy">
                        Confidential use
                    </a>
                </li>
                <li class="">
                    <a href="#encryption">
                        Encryption measures
                    </a>
                </li>
            </ul>
            <h3 id="policy">
                <span>
                    <Icon size=32 name="shredder"/>
                    Confidential use
                </span>
            </h3>
            <p>
                AI assistants, including Google Gemini, allow employees to read conversations and train the language models with your data. In cases such as personal, financial or health information, conversations musn’t be seen, shared, or used to build a profile about you or anyone else. This demonstration can't share your messages with anyone, including advertisers and governments. Furthermore, this service generates replies on the server using a ‘frozen’ language model to infer replies, it does not use your messages to train.
            </p>
            <h3 id="encryption">
                <span>
                    <Icon size=32 name="lock"/>
                    Encyption measures
                </span>
            </h3>
            <h4>Account and sign in</h4>
            <p>Server has zero-knowledge of user password</p>
            <ol>
                <li>User generates public/private key pair</li>
                <li>User password is used to genereate a strong key</li>
                <li>Strong key is used to encrypt the private key</li>
                <li>Server receives and stores public key, and encrypted private key</li>
                <li>User signs a challenge using their private key</li>
                <li>Server uses users the public key to verify the signature</li>
            </ol>
            <h4>Messaging</h4>
            <p>Server decryption requires authenticated, single-use, per message consents.</p>
            <p>Client side</p>
            <ol>
                <li>
                User writes a message and locks the message with a new key
                </li>
                <li>
                Client generetes a secret to share with the server for this message
                </li>
                <li>
                Client includes proof the secret is from them
                </li>
                <li>
                Client uses their own key to lock the message key for their use only
                </li>
                <li>
                Clients makes a temporary key that is used to lock the server's message key
                </li>
                <li>
                Client sends the locked message, the pair of locked message keys, the secret and the proof
                </li>
                <li>
                Client does not send or store the temporary key
                </li>
            </ol>
            <p>Server side</p>
            <ol>
                <li>
                Server confirms proof that the secret is from the client
                </li>
                <li>
                Server stores the locked message and the client's locked message key
                </li>
                <li>
                Server rebuilds the temporary key using the secret and the proof its from the user
                </li>
                <li>
                Server unlocks the message key and unlocks the message
                </li>
                <li>
                Server generates a reply message and locks the message using a new key
                </li>
                <li>
                Server locks the message key using the client's public key and stores the locked message and locked client key only
                </li>
                <li>
                Server sends the locked message and locked key that only the client can unlock
                </li>
            </ol>
            <h4>Storage</h4>
            <p>Reading</p>
            <ol>
                <li>Client requests their locked messages, each with its own locked key that only the client can unlock</li>
                <li>Client unlocks their message keys and uses these to unlock each message</li>
            </ol>
            <p>Context</p>
            <ol>
                <li>(Incomplete) Client relocks their messages using a message key</li>
                <li>(Incomplete) Client creates a new temporary key, secret and proof</li>
                <li>(Incomplete) Client locks the message key using the temporary key</li>
                <li>(Incomplete) Server verifies, derives, unwraps, decrpyts and replies as before, without retaining</li>
            </ol>
            <p>At rest</p>
            <ul>
                <li>The identity storage storage is separate and the API is split</li>
                <li>The message database links to the identity service by only one field</li>
                <!-- <li>(Incomplete) Tighter access controls on the idenitity database</li>
                <li>(Incomplete) The user's email is stored tokenised and hashed</li>
                <li>(Incomplete) The message database links to the identity service by token instead of email</li>
                <li>(Incomplete) Meta data is removed</li> -->
            </ul>
        </div>
    </main>
  </template>

<style scoped>
h2, h3 {
    margin: 3rem 0 2rem;
}
h3 span, 
h3 a {
    display: flex;
    align-items: center;
}
i {
 margin-right: 10px;   
}
main {
    padding-bottom: 3rem;
}
</style>