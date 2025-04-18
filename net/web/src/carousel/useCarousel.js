import { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useCarousel() {

  let [state, setState] = useState({
  });

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  let navigate = useNavigate();

  let actions = {
  };

  return { state, actions };
}


