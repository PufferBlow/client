import { Button, Modal } from "@pufferblow/spines";
import { useChannels } from "../../features/channels/hooks";
import { useVoice } from "../../features/voice/voiceContext";

/** Asks before joining a second voice channel, since a person can only be in one: joining it ends the first call. */
export function VoiceSwitchDialog() {
  const voice = useVoice();
  const { data: channels } = useChannels();
  if (!voice.pendingJoin) return null;

  const nameOf = (id: string | null) => channels?.find((c) => c.channel_id === id)?.channel_name ?? "another voice channel";
  const current = nameOf(voice.channelId);
  const next = nameOf(voice.pendingJoin);

  return (
    <Modal
      isOpen
      onClose={voice.cancelJoin}
      title="You're already in a voice channel"
      description={`You're in ${current}. To join ${next} you have to leave ${current} first.`}
      footer={
        <>
          <Button variant="ghost" onClick={voice.cancelJoin}>
            Stay in {current}
          </Button>
          <Button onClick={() => void voice.confirmJoin()}>Leave and join {next}</Button>
        </>
      }
    >
      <p className="m-0 text-sm text-text-tertiary">Your microphone and deafen settings carry over.</p>
    </Modal>
  );
}
