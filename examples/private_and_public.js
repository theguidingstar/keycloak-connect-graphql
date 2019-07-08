const fs = require('fs')
const path = require('path')
const express = require('express')
const session = require('express-session')
const Keycloak = require('keycloak-connect')
const { ApolloServer, gql } = require('apollo-server-express')

const { KeycloakContextProvider, KeycloakTypeDefs, schemaDirectives } = require('../')

const app = express()

const memoryStore = new session.MemoryStore()

const graphqlPath = '/graphql'


app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}))

const keycloakConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, './config/keycloak.json')))

const keycloak = new Keycloak({
  store: memoryStore
}, keycloakConfig)

// Install general keycloak middleware
app.use(keycloak.middleware({
  admin: graphqlPath
}))

// Protect the main route for all graphql services
// Disable unauthenticated access
app.use(graphqlPath, keycloak.middleware())

const typeDefs = gql`
  type Query {
    greetings: [String]!
  }

  type Mutation {
    addGreeting(greeting: String!): String! @auth
  }
`

const greetings = [
  'hello world!'
]

const resolvers = {
  Query: {
    greetings: () => greetings
  },
  Mutation: {
    addGreeting: (obj, { greeting }, context, info) => {
      greetings.push(greeting)
      return greeting
    }
  }
}

// Initialize the voyager server with our schema and context
const options ={
  typeDefs: [KeycloakTypeDefs, typeDefs],
  schemaDirectives: schemaDirectives,
  resolvers,
  context: ({ req }) => {
    return {
      auth: new KeycloakContextProvider({ req })
    }
  }
}

const server = new ApolloServer(options)

server.applyMiddleware({ app })

const port = 4000

app.listen({ port }, () =>
  console.log(`🚀 Server ready at http://localhost:${port}${server.graphqlPath}`)
) 