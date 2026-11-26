import GameTable from './GameTable'
import { useOnlineGame } from '../../game/useOnlineGame'
import { useLocalGame } from '../../game/useLocalGame'

export function OnlineTable({ room, user, ...rest }) {
  const game = useOnlineGame(room, user?.id)
  return <GameTable game={game} mode="online" user={user} {...rest} />
}

export function PracticeTable({ rules, myName, resume, ...rest }) {
  const game = useLocalGame({ rules, myName, resume })
  return <GameTable game={game} mode="practice" {...rest} />
}
