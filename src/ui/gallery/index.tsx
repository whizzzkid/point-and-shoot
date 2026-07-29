/// <reference lib="dom" />

import { type ComponentChildren, type JSX, render } from "preact";
import { useState } from "preact/hooks";
import {
  Badge,
  Button,
  CaptureMinimap,
  Card,
  Checkbox,
  Dialog,
  Icon,
  IconButton,
  Input,
  Select,
  Switch,
  Tabs,
  Tag,
  Toast,
  Tooltip,
} from "../components/index.ts";

const THEMES = ["dark", "light"] as const;

function Story(
  { name, children }: { readonly name: string; readonly children: ComponentChildren },
): JSX.Element {
  return (
    <article className="gallery-story" data-component={name}>
      <h3>{name}</h3>
      <div className="gallery-story__content">{children}</div>
    </article>
  );
}

function StateGallery(): JSX.Element {
  return (
    <section className="gallery-states" aria-label="Review states">
      <h3>Review states</h3>
      <div className="gallery-states__grid">
        <div data-state="default">
          <Button variant="secondary">Default</Button>
        </div>
        <div data-state="hover">
          <Button variant="secondary">Hover</Button>
        </div>
        <div data-state="focus">
          <Button variant="secondary">Focus</Button>
        </div>
        <div data-state="active">
          <Button variant="secondary">Active</Button>
        </div>
        <div data-state="disabled">
          <Button disabled>Disabled</Button>
        </div>
        <div data-state="error">
          <Input placeholder="Couldn't save — try again." />
        </div>
        <div data-state="loading">
          <Button disabled>Sending…</Button>
        </div>
        <div data-state="empty">
          <Card>No notes yet.</Card>
        </div>
      </div>
    </section>
  );
}

function ThemeGallery({ theme }: { readonly theme: (typeof THEMES)[number] }): JSX.Element {
  const [checked, setChecked] = useState(true);
  const [selected, setSelected] = useState("local");
  const [activeTab, setActiveTab] = useState("Overview");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tagVisible, setTagVisible] = useState(true);

  return (
    <section className="gallery-theme" data-theme={theme}>
      <header className="gallery-theme__header">
        <p>Component specimens</p>
        <h2>{theme === "dark" ? "Dark theme" : "Light theme"}</h2>
      </header>
      <div className="gallery-grid">
        <Story name="Button">
          <Button>Send to agent</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="danger">Delete note</Button>
        </Story>
        <Story name="IconButton">
          <IconButton
            active
            icon={<Icon name="crosshair" />}
            label={`${theme} select element`}
          />
          <IconButton icon={<Icon name="camera" />} label={`${theme} capture region`} />
        </Story>
        <Story name="Card">
          <Card>
            <strong>button.cta-primary</strong>
            <small>2 elements selected</small>
          </Card>
        </Story>
        <Story name="Badge">
          <Badge tone="accent">sent</Badge>
          <Badge tone="success">fixed</Badge>
          <Badge tone="warning">pending</Badge>
          <Badge tone="danger">failed</Badge>
        </Story>
        <Story name="Tag">
          {tagVisible
            ? <Tag onRemove={() => setTagVisible(false)}>button.cta-primary</Tag>
            : <span>Tag removed</span>}
        </Story>
        <Story name="Icon">
          <Icon name="camera" size={24} />
          <Icon name="crosshair" size={24} />
          <Icon name="settings" size={24} />
        </Story>
        <Story name="Input">
          <Input placeholder="What's wrong here?" multiline rows={3} />
          <Input mono value="//*[@id='card']/div[2]" />
        </Story>
        <Story name="Select">
          <label>
            <span>{theme} target agent</span>
            <Select
              onChange={setSelected}
              options={[
                { label: "Local agent", value: "local" },
                { label: "Cursor agent", value: "cursor" },
              ]}
              value={selected}
            />
          </label>
        </Story>
        <Story name="Checkbox">
          <Checkbox
            checked={checked}
            label="Include DOM context"
            onChange={setChecked}
          />
        </Story>
        <Story name="Switch">
          <label className="gallery-setting">
            <span>{theme} component hints</span>
            <Switch checked={checked} onChange={setChecked} />
          </label>
        </Story>
        <Story name="Tooltip">
          <Tooltip label="Capture region">
            <IconButton icon={<Icon name="camera" />} label={`${theme} tooltip trigger`} />
          </Tooltip>
        </Story>
        <Story name="Toast">
          <Toast tone="success">Note saved with screenshot and XPath.</Toast>
        </Story>
        <Story name="Dialog">
          <Button onClick={() => setDialogOpen(true)} variant="secondary">Preview dialog</Button>
          <Dialog
            footer={
              <>
                <Button onClick={() => setDialogOpen(false)} variant="ghost">Cancel</Button>
                <Button onClick={() => setDialogOpen(false)}>Send</Button>
              </>
            }
            onClose={() => setDialogOpen(false)}
            open={dialogOpen}
            title="Send to agent?"
          >
            This will compile 4 notes into a plan prompt.
          </Dialog>
        </Story>
        <Story name="Tabs">
          <Tabs
            active={activeTab}
            onChange={setActiveTab}
            tabs={["Overview", "Elements"]}
          />
        </Story>
        <Story name="CaptureMinimap">
          <CaptureMinimap
            height={90}
            label={`${theme} clipped captured region`}
            region={{ x: 0.06, y: 0.08, w: 0.86, h: 0.1 }}
            screenshot="/gallery-capture.png"
            truncated
            width={120}
          />
        </Story>
      </div>
      <StateGallery />
    </section>
  );
}

function BehaviorHarness(): JSX.Element {
  const [checked, setChecked] = useState(false);
  const [changeCount, setChangeCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("local");
  const [showToast, setShowToast] = useState(false);
  const [toastCloseCount, setToastCloseCount] = useState(0);
  const [activeTab, setActiveTab] = useState("Notes");
  const [noteText, setNoteText] = useState("");
  const [includeDom, setIncludeDom] = useState(false);
  const [buttonClickCount, setButtonClickCount] = useState(0);

  return (
    <section className="gallery-harness" data-theme="dark">
      <h2>Behavior harness</h2>
      <label className="gallery-setting">
        <span>Capture framework component names</span>
        <Switch
          checked={checked}
          onChange={(nextChecked) => {
            setChecked(nextChecked);
            setChangeCount((count) => count + 1);
          }}
        />
      </label>
      <output data-testid="switch-change-count">{changeCount}</output>
      <button onClick={() => setDialogOpen(true)} type="button">Open dialog</button>
      <Dialog
        footer={
          <>
            <button onClick={() => setDialogOpen(false)} type="button">Cancel</button>
            <button onClick={() => setDialogOpen(false)} type="button">Send plan</button>
          </>
        }
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
        title="Send plan to agent?"
      >
        This will compile the current notes into a plan prompt.
      </Dialog>
      <label>
        <span>Target agent</span>
        <Select
          onChange={setSelectedAgent}
          options={[
            { label: "Local agent", value: "local" },
            { label: "Cursor agent", value: "cursor" },
          ]}
          value={selectedAgent}
        />
      </label>
      <output data-testid="select-value">{selectedAgent}</output>
      <button onClick={() => setShowToast(true)} type="button">Show toast</button>
      {showToast
        ? (
          <Toast
            onClose={() => {
              setShowToast(false);
              setToastCloseCount((count) => count + 1);
            }}
            tone="success"
          >
            Note saved with screenshot and XPath.
          </Toast>
        )
        : null}
      <output data-testid="toast-close-count">{toastCloseCount}</output>
      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={["Notes", "Plan", "Settings"]}
      />
      <output data-testid="tabs-value">{activeTab}</output>
      <Input onChange={setNoteText} placeholder="Behavior note" value={noteText} />
      <output data-testid="input-value">{noteText}</output>
      <Checkbox
        checked={includeDom}
        label="Behavior DOM context"
        onChange={setIncludeDom}
      />
      <output data-testid="checkbox-value">{String(includeDom)}</output>
      <Button onClick={() => setButtonClickCount((count) => count + 1)}>
        Run component action
      </Button>
      <Button disabled>Unavailable component action</Button>
      <IconButton
        active
        icon={<Icon name="crosshair" />}
        label="Active component tool"
      />
      <output data-testid="button-click-count">{buttonClickCount}</output>
    </section>
  );
}

function Gallery(): JSX.Element {
  return (
    <main className="gallery">
      <header className="gallery-header">
        <p>Point and Shoot design system</p>
        <h1>Point and Shoot component gallery</h1>
        <span>15 components · both themes · interaction states</span>
      </header>
      <BehaviorHarness />
      {THEMES.map((theme) => <ThemeGallery key={theme} theme={theme} />)}
    </main>
  );
}

const root = document.getElementById("app");
if (root === null) throw new Error("gallery/index.html is missing #app");
render(<Gallery />, root);
