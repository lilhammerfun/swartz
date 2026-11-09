import { useState } from "react";
import { Eye, EyeOff } from "./icons";
import { IconButton } from "./IconButton";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group";

export function PasswordInput(
  props: Omit<React.ComponentProps<"input">, "type">,
) {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup className="password-input">
      <InputGroupInput {...props} type={visible ? "text" : "password"} />
      <InputGroupAddon align="inline-end">
        <IconButton
          size="icon-xs"
          label={visible ? "Hide API key" : "Show API key"}
          disabled={props.disabled}
          aria-pressed={visible}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </IconButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
