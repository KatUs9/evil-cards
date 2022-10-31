import { nanoid } from "nanoid"
import Emittery from "emittery"

import { whiteCards, redCards } from "./cards"
import getRandomInt from "../functions/get-random-int"

import type { Status, User, Vote } from "../ws/send"
import type { SessionEventBus } from "./types"

export type Sender<T> = {
  send: (data: T) => void
}
export type UserData<T> = {
  sender: Sender<T>
  whiteCards: string[]
}

class Session<T = string> {
  private _userData: WeakMap<User, UserData<T>> = new WeakMap()
  private _availableRedCards = [...redCards]
  private _availableWhiteCards = [...whiteCards]
  private _masterIndex = 0
  private _countdownTimeout: NodeJS.Timeout | null = null

  private _votes: Vote[] = []
  private _users: User[] = []
  private _id: string
  private _redCard: string | null = null
  private _status: Status = "waiting"
  private _eventBus: SessionEventBus

  public get votes() {
    return this._votes
  }
  public get users() {
    return this._users
  }
  public get id() {
    return this._id
  }
  public get redCard() {
    return this._redCard
  }
  public get status() {
    return this._status
  }
  public get eventBus() {
    return this._eventBus
  }

  constructor() {
    const id = nanoid(5)
    this._id = id
    this._eventBus = new Emittery()
  }

  public addUser(
    sender: Sender<T>,
    username: string,
    avatarId: number,
    host: boolean
  ) {
    const id = nanoid(5)
    const user: User = {
      id,
      avatarId,
      username,
      score: 0,
      host,
      master: false,
      voted: false,
      disconnected: false
    }
    this._users.push(user)
    this._userData.set(user, {
      sender,
      whiteCards: []
    })

    return user
  }

  public reconnectUser(sender: Sender<T>, user: User, avatarId: number) {
    const userData = this._userData.get(user)
    if (!userData) {
      throw new Error("no userdata found")
    }

    userData.sender = sender
    user.disconnected = false
    user.avatarId = avatarId
  }

  public disconnectUser(
    user: User,
    callbacks?: {
      onSessionEnd?: () => void
      onDisconnect?: (anyActivePlayers: boolean) => void
    }
  ) {
    const isHost = user.host

    if (this.status == "waiting") {
      this._users = this.users.filter(
        (sessionUser) => sessionUser.id != user.id
      )
    } else {
      user.disconnected = true
    }

    const connectedUsers = this.users.filter(
      (user) => user.disconnected == false
    )
    if (connectedUsers.length == 0) {
      this._countdownTimeout && clearTimeout(this._countdownTimeout)
      this._countdownTimeout = null
      if (callbacks?.onSessionEnd) {
        callbacks?.onSessionEnd()
      }
      if (callbacks?.onDisconnect) {
        callbacks.onDisconnect(false)
      }

      return
    }

    if (isHost && connectedUsers[0]) {
      connectedUsers[0].host = true
    }

    if (this.status != "waiting" && user.master) {
      user.master = false

      // decide who is master
      let masterUser = this.users[this._masterIndex]
      if (!masterUser) {
        throw new Error("smth happened")
      }
      if (masterUser.disconnected) {
        this.updateMasterIndex()
      }
      masterUser = this.users[this._masterIndex]
      if (!masterUser) {
        throw new Error("smth happened")
      }
      masterUser.master = true
      this.updateMasterIndex()
    }

    if (callbacks?.onDisconnect) {
      callbacks.onDisconnect(true)
    }

    if (this.status != "waiting" && connectedUsers.length == 1) {
      this.endGame()
    }
  }

  public vote(user: User, text: string, callbacks?: { onVote?: () => void }) {
    const userData = this._userData.get(user)
    if (!userData) {
      throw new Error("no userdata found")
    }

    user.voted = true
    userData.whiteCards = userData.whiteCards.filter(
      (cardText) => text != cardText
    )
    this.votes.push({ text, userId: user.id, visible: false })

    if (callbacks?.onVote) {
      callbacks.onVote()
    }

    let allVoted = true
    for (const user of this.users) {
      if (!user.master && !user.voted && !user.disconnected) {
        allVoted = false
      }
    }
    if (allVoted) {
      this.startChoosing()
    }
  }

  public startGame() {
    this._status = "starting"

    this.eventBus.emit("starting")
    setTimeout(() => this.startVoting(), 3000)
  }

  public startVoting() {
    // prepare
    this._votes = []
    for (const user of this.users) {
      user.voted = false
    }
    this._status = "voting"

    // unmaster previous user
    const prevMasterUser = this.users.find((user) => user.master == true)
    if (prevMasterUser) {
      prevMasterUser.master = false
    }

    // decide who is master
    let masterUser = this.users[this._masterIndex]
    if (!masterUser) {
      throw new Error("smth happened")
    }
    if (masterUser.disconnected) {
      this.updateMasterIndex()
    }
    masterUser = this.users[this._masterIndex]
    if (!masterUser) {
      throw new Error("smth happened")
    }
    masterUser.master = true
    this.updateMasterIndex()

    // get red card
    if (this._availableRedCards.length == 0) {
      this._availableRedCards = redCards
    }
    const redCardIndex = getRandomInt(0, this._availableRedCards.length - 1)
    const redCard = this._availableRedCards[redCardIndex]
    if (!redCard) {
      throw new Error("smth happened")
    }
    this._redCard = redCard
    this._availableRedCards.splice(redCardIndex, 1)

    // get up to 10 white cards
    for (const user of this.users) {
      const whiteCards = this.getUserWhitecards(user)
      const whiteCardsLength = whiteCards.length

      for (let i = 0; i < 10 - whiteCardsLength; i++) {
        const whiteCardIndex = getRandomInt(
          0,
          this._availableWhiteCards.length - 1
        )
        const whiteCard = this._availableWhiteCards[whiteCardIndex]
        if (whiteCard) whiteCards.push(whiteCard)
        this._availableWhiteCards.splice(whiteCardIndex, 1)
      }
    }

    this.eventBus.emit("voting")

    this._countdownTimeout = setTimeout(() => {
      this._countdownTimeout && clearTimeout(this._countdownTimeout)
      this._countdownTimeout = null
      this.startChoosing()
    }, 60000)
  }

  public startChoosing() {
    this._countdownTimeout && clearTimeout(this._countdownTimeout)
    this._countdownTimeout = null

    this._status = "choosing"

    this.users.forEach((user) => {
      if (!user.voted && !user.master && !user.disconnected) {
        const userWhitecards = this.getUserWhitecards(user)
        const randomCardIndex = getRandomInt(0, userWhitecards.length - 1)
        const text = userWhitecards[randomCardIndex]
        if (!text) {
          throw new Error("smth happened")
        }
        user.voted = true
        this.votes.push({ text, userId: user.id, visible: false })
        userWhitecards.splice(randomCardIndex, 1)
      }
    })

    this.eventBus.emit("choosing")
  }

  public choose(userId: string, callbacks?: { onChoose?: () => void }) {
    const card = this.votes.find((card) => card.userId == userId)
    if (!card) {
      throw new Error("provided user did not vote")
    }
    card.visible = true

    if (callbacks?.onChoose) {
      callbacks.onChoose()
    }

    if (this.votes.every((vote) => vote.visible)) {
      this._status = "choosingbest"
      this.eventBus.emit("choosingbest")
    }
  }

  public chooseBest(userId: string) {
    const votedUser = this.users.find((user) => user.id == userId)
    if (!votedUser) {
      throw new Error("provided user did not vote")
    }

    votedUser.score += 1
    if (votedUser.score >= 10) {
      this.endGame()
    } else {
      this.startVoting()
    }
  }

  public endGame() {
    this._status = "end"
    this._redCard = null
    this._votes = []
    this._availableRedCards = redCards
    this._availableWhiteCards = whiteCards
    this._countdownTimeout && clearTimeout(this._countdownTimeout)
    this._countdownTimeout = null
    this._masterIndex = 0

    this._users = this.users.filter((user) => user.disconnected == false)
    for (const user of this.users) {
      this.getUserWhitecards(user).length = 0
      user.master = false
      user.voted = false
      user.score = 0
    }

    this.eventBus.emit("end")
  }

  public getUserSender(user: User) {
    const userData = this._userData.get(user)
    if (!userData) {
      throw new Error("no userdata found")
    }

    return userData.sender
  }

  public getUserWhitecards(user: User) {
    const userData = this._userData.get(user)
    if (!userData) {
      throw new Error("no userdata found")
    }

    return userData.whiteCards
  }

  private updateMasterIndex() {
    let masterIndex = this._masterIndex

    do {
      if (masterIndex + 1 >= this.users.length) {
        masterIndex = 0
      } else {
        masterIndex += 1
      }
    } while (this.users[masterIndex]?.disconnected == true)

    this._masterIndex = masterIndex
  }
}

export default Session